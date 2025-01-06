export function fetchLibTemplates() {
  return [
    {
      file: "OpenSDKHttpClient.java",
      template() {
        return `@FunctionalInterface
public interface OpenSDKHttpClient {
  <T, U> T execute(String method, String path, RequestDetails<U> details, Class<T> response);
}
`;
      },
    },
    {
      file: "RequestDetails.java",
      template() {
        return `import java.util.List;
import java.util.Map;

public final class RequestDetails<T> {
  private final Map<String, List<String>> query;
  private final Map<String, List<String>> headers;
  private final T body;

  public RequestDetails(Map<String, List<String>> query, Map<String, List<String>> headers, T body) {
    this.query = query;
    this.headers = headers;
    this.body = body;
  }

  public Map<String, List<String>> query() {
    return query;
  }

  public Map<String, List<String>> headers() {
    return headers;
  }

  public T body() {
    return body;
  }
}`;
      },
    },
  ];
}
