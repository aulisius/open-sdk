@FunctionalInterface
public interface OpenSDKHttpClient {
  <Body, Response> Response execute(RequestDescription<Body> request, Class<Response> responseType);
}