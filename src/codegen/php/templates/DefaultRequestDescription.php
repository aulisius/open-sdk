abstract class DefaultRequestDescription implements RequestDescription
{

  protected array $queryParams = [];
  protected array $pathParams = [];
  protected array $headers = [];
  protected mixed $body;

  public function __construct()
  {
  }

  abstract protected function pathRaw(): string;

  public function path(): string
  {
    return strtr($this->pathRaw(), $this->pathParams());
  }

  public function method(): string
  {
    return "GET";
  }

  public function setQuery(string $name, string $value)
  {
    if (!key_exists($name, $this->queryParams)) {
      $this->queryParams[$name] = [];
    }
    $this->queryParams[$name][] = $value;
  }

  protected function mandatoryQueryParams(): array
  {
    return [];
  }

  public function query(): array
  {
    $qs = $this->mandatoryQueryParams();
    $missing = [];
    foreach ($qs as $key) {
      if (!key_exists($key, $this->queryParams)) {
        $missing[] = $key;
      }
    }
    if (\count($missing) > 0) {
      throw new \InvalidArgumentException("Mandatory query parameters are missing: " . \implode(",", $missing));
    }
    return $this->queryParams;
  }

  protected function mandatoryPathParams(): array
  {
    return [];
  }

  public function pathParams(): array
  {
    $qs = $this->mandatoryPathParams();
    $missing = [];
    foreach ($qs as $key) {
      if (!key_exists($key, $this->pathParams)) {
        $missing[] = $key;
      }
    }
    if (\count($missing) > 0) {
      throw new \InvalidArgumentException("Mandatory path parameters are missing: " . \implode(",", $missing));
    }
    return $this->pathParams;
  }

  public function setHeader(string $name, string $value)
  {
    if (!key_exists($name, $this->headers)) {
      $this->headers[$name] = [];
    }
    $this->headers[$name][] = $value;
  }

  public function headers(): array
  {
    return $this->headers;
  }

  public function body(): mixed
  {
    return $this->body;
  }
}