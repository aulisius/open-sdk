import java.util.Collections;
import java.util.List;
import java.util.Map;

public interface RequestDescription<Body> {
  default String method() {
    return "GET";
  }

  String path();

  default Map<String, String> pathParams() {
    return Collections.emptyMap();
  }

  void query(String name, String value);
  default Map<String, List<String>> query() {
    return Collections.emptyMap();
  }

  void header(String name, String value);
  default Map<String, List<String>> headers() {
    return Collections.emptyMap();
  }

  default Body body() {
    return null;
  }
}