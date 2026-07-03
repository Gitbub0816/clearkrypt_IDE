using System.Text;
using System.Text.Json;
using ClearKryptIDE.Core.Lsp.JsonRpc;
using Xunit;

namespace ClearKryptIDE.Core.Tests;

/// <summary>
/// Exercises framing and correlation using in-process duplex pipes: the test
/// plays the server side, writing framed JSON into the stream the connection
/// reads from.
/// </summary>
public sealed class JsonRpcConnectionTests
{
    private static byte[] Frame(string json)
    {
        var body = Encoding.UTF8.GetBytes(json);
        var header = Encoding.ASCII.GetBytes($"Content-Length: {body.Length}\r\n\r\n");
        return header.Concat(body).ToArray();
    }

    [Fact]
    public async Task CorrelatesRequestWithResponse()
    {
        var incoming = new BlockingPipeStream();
        var outgoing = new MemoryStream();
        await using var connection = new JsonRpcConnection(incoming, outgoing);

        var requestTask = connection.SendRequestAsync("test/method", new { input = 1 });
        incoming.Feed(Frame("""{"jsonrpc":"2.0","id":1,"result":{"answer":42}}"""));

        var result = await requestTask.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(42, result.GetProperty("answer").GetInt32());

        var sent = Encoding.UTF8.GetString(outgoing.ToArray());
        Assert.Contains("Content-Length:", sent);
        Assert.Contains("\"method\":\"test/method\"", sent);
    }

    [Fact]
    public async Task DispatchesNotificationsSplitAcrossChunks()
    {
        var framed = Frame("""{"jsonrpc":"2.0","method":"textDocument/publishDiagnostics","params":{"uri":"file:///x.ck","diagnostics":[]}}""");
        var incoming = new BlockingPipeStream();

        var received = new TaskCompletionSource<(string Method, JsonElement? Params)>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        await using var connection = new JsonRpcConnection(incoming, new MemoryStream());
        connection.NotificationReceived += (method, @params) => received.TrySetResult((method, @params));

        var half = framed.Length / 2;
        incoming.Feed(framed.AsSpan(0, half).ToArray());
        await Task.Delay(50);
        incoming.Feed(framed.AsSpan(half).ToArray());

        var (methodName, payload) = await received.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal("textDocument/publishDiagnostics", methodName);
        Assert.Equal("file:///x.ck", payload!.Value.GetProperty("uri").GetString());
    }

    [Fact]
    public async Task DispatchesTwoMessagesArrivingInOneChunk()
    {
        var one = Frame("""{"jsonrpc":"2.0","method":"a","params":{}}""");
        var two = Frame("""{"jsonrpc":"2.0","method":"b","params":{}}""");
        var incoming = new BlockingPipeStream();

        var methods = new List<string>();
        var second = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        await using var connection = new JsonRpcConnection(incoming, new MemoryStream());
        connection.NotificationReceived += (method, _) =>
        {
            lock (methods)
            {
                methods.Add(method);
                if (methods.Count == 2)
                {
                    second.TrySetResult();
                }
            }
        };

        incoming.Feed(one.Concat(two).ToArray());
        await second.Task.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(new[] { "a", "b" }, methods);
    }

    /// <summary>
    /// A read stream fed by the test. Reads block until data is available,
    /// like a real process pipe, so the connection's read loop stays alive.
    /// </summary>
    private sealed class BlockingPipeStream : Stream
    {
        private readonly SemaphoreSlim _dataAvailable = new(0);
        private readonly object _lock = new();
        private readonly Queue<byte> _buffer = new();

        public void Feed(byte[] data)
        {
            lock (_lock)
            {
                foreach (var b in data)
                {
                    _buffer.Enqueue(b);
                }
            }
            _dataAvailable.Release();
        }

        public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        {
            for (;;)
            {
                lock (_lock)
                {
                    if (_buffer.Count > 0)
                    {
                        var read = 0;
                        while (read < count && _buffer.Count > 0)
                        {
                            buffer[offset + read] = _buffer.Dequeue();
                            read++;
                        }
                        return read;
                    }
                }
                await _dataAvailable.WaitAsync(cancellationToken);
            }
        }

        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken cancellationToken = default)
        {
            var array = new byte[buffer.Length];
            return new ValueTask<int>(ReadAsync(array, 0, array.Length, cancellationToken)
                .ContinueWith(t =>
                {
                    array.AsSpan(0, t.Result).CopyTo(buffer.Span);
                    return t.Result;
                }, cancellationToken, TaskContinuationOptions.OnlyOnRanToCompletion, TaskScheduler.Default));
        }

        public override int Read(byte[] buffer, int offset, int count) =>
            ReadAsync(buffer, offset, count, CancellationToken.None).GetAwaiter().GetResult();

        public override bool CanRead => true;
        public override bool CanSeek => false;
        public override bool CanWrite => false;
        public override long Length => throw new NotSupportedException();
        public override long Position
        {
            get => throw new NotSupportedException();
            set => throw new NotSupportedException();
        }

        public override void Flush()
        {
        }

        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
    }
}
