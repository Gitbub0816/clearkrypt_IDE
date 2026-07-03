using System.Collections.Concurrent;
using System.Globalization;
using System.Text;
using System.Text.Json;
using ClearKryptIDE.Core.Json;

namespace ClearKryptIDE.Core.Lsp.JsonRpc;

/// <summary>
/// A minimal JSON-RPC 2.0 client over two streams, using LSP's
/// <c>Content-Length</c> header framing (docs/21-language-server.md).
/// Handles request/response correlation by id, dispatches server
/// notifications, honors <see cref="CancellationToken"/> via
/// <c>$/cancelRequest</c>, and exposes <see cref="Disconnected"/> so callers
/// can detect the far end going away (crash or normal exit).
/// </summary>
public sealed class JsonRpcConnection : IAsyncDisposable
{
    private readonly Stream _input;
    private readonly Stream _output;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private readonly ConcurrentDictionary<long, TaskCompletionSource<JsonElement>> _pending = new();
    private readonly CancellationTokenSource _cts = new();
    private readonly Task _readLoopTask;
    private long _nextId;

    /// <summary>Raised for every server-to-client notification: (method, params).</summary>
    public event Action<string, JsonElement?>? NotificationReceived;

    /// <summary>Raised once when the read loop ends, i.e. the connection is gone. Null exception means clean EOF.</summary>
    public event Action<Exception?>? Disconnected;

    public JsonRpcConnection(Stream input, Stream output)
    {
        _input = input;
        _output = output;
        _readLoopTask = Task.Run(() => ReadLoopAsync(_cts.Token));
    }

    public async Task<JsonElement> SendRequestAsync(string method, object? @params, CancellationToken cancellationToken = default)
    {
        var id = Interlocked.Increment(ref _nextId);
        var tcs = new TaskCompletionSource<JsonElement>(TaskCreationOptions.RunContinuationsAsynchronously);
        _pending[id] = tcs;

        var registration = cancellationToken.CanBeCanceled
            ? cancellationToken.Register(() =>
            {
                _ = SendNotificationAsync("$/cancelRequest", new { id });
                tcs.TrySetCanceled(cancellationToken);
            })
            : default;

        try
        {
            await WriteMessageAsync(new Dictionary<string, object?>
            {
                ["jsonrpc"] = "2.0",
                ["id"] = id,
                ["method"] = method,
                ["params"] = @params,
            }).ConfigureAwait(false);

            return await tcs.Task.ConfigureAwait(false);
        }
        finally
        {
            registration.Dispose();
            _pending.TryRemove(id, out _);
        }
    }

    public Task SendNotificationAsync(string method, object? @params)
    {
        return WriteMessageAsync(new Dictionary<string, object?>
        {
            ["jsonrpc"] = "2.0",
            ["method"] = method,
            ["params"] = @params,
        });
    }

    /// <summary>Waits for the background read loop to end (connection closed for any reason).</summary>
    public Task Completion => _readLoopTask;

    private async Task WriteMessageAsync(object payload)
    {
        var json = JsonSerializer.Serialize(payload, JsonOptions.Default);
        var jsonBytes = Encoding.UTF8.GetBytes(json);
        var header = Encoding.ASCII.GetBytes($"Content-Length: {jsonBytes.Length}\r\n\r\n");

        await _writeLock.WaitAsync().ConfigureAwait(false);
        try
        {
            await _output.WriteAsync(header).ConfigureAwait(false);
            await _output.WriteAsync(jsonBytes).ConfigureAwait(false);
            await _output.FlushAsync().ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private async Task ReadLoopAsync(CancellationToken ct)
    {
        Exception? failure = null;
        try
        {
            while (!ct.IsCancellationRequested)
            {
                var json = await ReadMessageAsync(ct).ConfigureAwait(false);
                if (json is null)
                {
                    break;
                }

                Dispatch(json);
            }
        }
        catch (OperationCanceledException)
        {
            // Disposal requested; not a failure.
        }
        catch (Exception ex)
        {
            failure = ex;
        }
        finally
        {
            foreach (var pending in _pending.Values)
            {
                pending.TrySetException(failure ?? new IOException("The language server connection was closed."));
            }

            Disconnected?.Invoke(failure);
        }
    }

    private async Task<string?> ReadMessageAsync(CancellationToken ct)
    {
        int? contentLength = null;
        while (true)
        {
            var line = await ReadHeaderLineAsync(ct).ConfigureAwait(false);
            if (line is null)
            {
                return null; // EOF before any header - clean shutdown.
            }

            if (line.Length == 0)
            {
                break; // blank line ends the header block.
            }

            var separatorIndex = line.IndexOf(':');
            if (separatorIndex <= 0)
            {
                continue;
            }

            var name = line[..separatorIndex].Trim();
            var value = line[(separatorIndex + 1)..].Trim();
            if (name.Equals("Content-Length", StringComparison.OrdinalIgnoreCase) &&
                int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
            {
                contentLength = parsed;
            }
        }

        if (contentLength is null)
        {
            throw new InvalidDataException("LSP message frame is missing a Content-Length header.");
        }

        var body = new byte[contentLength.Value];
        await _input.ReadExactlyAsync(body, ct).ConfigureAwait(false);
        return Encoding.UTF8.GetString(body);
    }

    private async Task<string?> ReadHeaderLineAsync(CancellationToken ct)
    {
        var bytes = new List<byte>();
        var singleByte = new byte[1];
        while (true)
        {
            var read = await _input.ReadAsync(singleByte.AsMemory(0, 1), ct).ConfigureAwait(false);
            if (read == 0)
            {
                return bytes.Count == 0 ? null : Encoding.ASCII.GetString(bytes.ToArray());
            }

            if (singleByte[0] == (byte)'\n')
            {
                if (bytes.Count > 0 && bytes[^1] == (byte)'\r')
                {
                    bytes.RemoveAt(bytes.Count - 1);
                }

                return Encoding.ASCII.GetString(bytes.ToArray());
            }

            bytes.Add(singleByte[0]);
        }
    }

    private void Dispatch(string json)
    {
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        if (root.TryGetProperty("method", out var methodProp))
        {
            var method = methodProp.GetString() ?? string.Empty;
            JsonElement? paramsElement = root.TryGetProperty("params", out var p) ? p.Clone() : null;

            if (root.TryGetProperty("id", out var requestId))
            {
                _ = RespondMethodNotFoundAsync(requestId.Clone(), method);
            }
            else
            {
                NotificationReceived?.Invoke(method, paramsElement);
            }

            return;
        }

        if (root.TryGetProperty("id", out var idProp) && TryGetId(idProp, out var id) && _pending.TryGetValue(id, out var tcs))
        {
            if (root.TryGetProperty("error", out var errorProp))
            {
                var message = errorProp.TryGetProperty("message", out var messageProp)
                    ? messageProp.GetString() ?? "Unknown error"
                    : "Unknown error";
                var code = errorProp.TryGetProperty("code", out var codeProp) ? codeProp.GetInt32() : 0;
                tcs.TrySetException(new JsonRpcException(code, message));
            }
            else if (root.TryGetProperty("result", out var resultProp))
            {
                tcs.TrySetResult(resultProp.Clone());
            }
            else
            {
                tcs.TrySetResult(default);
            }
        }
    }

    private async Task RespondMethodNotFoundAsync(JsonElement id, string method)
    {
        object? idValue = id.ValueKind == JsonValueKind.Number ? id.GetInt64() : id.GetString();
        await WriteMessageAsync(new Dictionary<string, object?>
        {
            ["jsonrpc"] = "2.0",
            ["id"] = idValue,
            ["error"] = new Dictionary<string, object?>
            {
                ["code"] = -32601,
                ["message"] = $"Method not found: {method}",
            },
        }).ConfigureAwait(false);
    }

    private static bool TryGetId(JsonElement idProp, out long id)
    {
        switch (idProp.ValueKind)
        {
            case JsonValueKind.Number when idProp.TryGetInt64(out id):
                return true;
            case JsonValueKind.String when long.TryParse(idProp.GetString(), out id):
                return true;
            default:
                id = 0;
                return false;
        }
    }

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        try
        {
            await _readLoopTask.ConfigureAwait(false);
        }
        catch
        {
            // Read loop failures are surfaced via Disconnected; ignore on dispose.
        }

        _writeLock.Dispose();
        _cts.Dispose();
    }
}
