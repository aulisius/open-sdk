import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.ArrayList;
import java.util.Map;

public abstract class DefaultRequestDescription<B> implements RequestDescription<B> {
  protected final Map<String, String> pathParams = new LinkedHashMap<>();
  protected final Map<String, List<String>> queryParams = new LinkedHashMap<>();
  protected final Map<String, List<String>> headers = new LinkedHashMap<>();
  protected B body;

  protected List<String> mandatoryPathParams() {
    return Collections.emptyList();
  }

  @Override
  public Map<String, String> pathParams() {
    var params = mandatoryPathParams();
    var missing = params.stream().filter(param -> !pathParams.containsKey(param)).findAny();
    if (missing.isPresent()) {
      throw new IllegalArgumentException("Mandatory path parameters are missing: %s".formatted(missing.get()));
    }
    return pathParams;
  }

  public void body(B body) {
    this.body = body;
  }

  protected boolean isBodyMandatory() {
    return false;
  }

  @Override
  public B body() {
    if (isBodyMandatory() && body == null) {
      throw new IllegalArgumentException("Body is required");
    }
    return this.body;
  }

  protected List<String> mandatoryQueryParams() {
    return Collections.emptyList();
  }

  @Override
  public Map<String, List<String>> query() {
    var qs = mandatoryQueryParams();
    var missing = qs.stream().filter(q -> !queryParams.containsKey(q)).findAny();
    if (missing.isPresent()) {
      throw new IllegalArgumentException("Mandatory query parameters are missing: %s".formatted(missing.get()));
    }
    return queryParams;
  }

  @Override
  public void query(String name, String value) {
    var values = queryParams.computeIfAbsent(name, k -> new ArrayList<>(1));
    values.add(value);
  }

  @Override
  public void header(String name, String value) {
    var values = headers.computeIfAbsent(name, k -> new ArrayList<>(1));
    values.add(value);
  }

  @Override
  public Map<String, List<String>> headers() {
    return headers;
  }
}
