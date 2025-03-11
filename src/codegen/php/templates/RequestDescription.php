interface RequestDescription {
    public function method(): string;
    public function path(): string;
    public function pathParams(): array;

    public function setQuery(string $name, string $value);

    public function query(): array;
    public function setHeader(string $name, string $value);
    public function headers(): array;
    public function body(): mixed;
}