namespace ClearKryptIDE.Core.Lsp.JsonRpc;

/// <summary>A JSON-RPC 2.0 error response, thrown from a request's awaited task.</summary>
public sealed class JsonRpcException : Exception
{
    public int Code { get; }

    public JsonRpcException(int code, string message)
        : base(message)
    {
        Code = code;
    }
}
