# OpenSDK Generator

A flexible SDK generator that creates type-safe API client libraries from OpenAPI 3.x specifications.

## Features

- Generates client libraries from OpenAPI 3.x specifications
- Supports multiple programming languages:
  - TypeScript
  - Java
  - PHP
- Creates type-safe interfaces and models
- Generates service classes for API operations
- Handles proper file organization and dependencies

## Installation

```bash
npm install @faizaanceg/open-sdk
```

## Usage

```bash
open-sdk generate --spec api-spec.json --language typescript --output ./sdk
```

### CLI Options

- `--spec` (-S): Path to your OpenAPI specification file (required)
- `--language` (-L): Target programming language: typescript, java, or php (required)
- `--output` (-o): Output directory for the generated SDK (required)
- `--dry-run`: Preview generated files without writing to disk

## Generated SDK Structure

The structure varies by language but generally includes:

### TypeScript
```
sdk/
├── resources/           # Generated interfaces and models
├── services/           # Service classes for API operations
├── lib/               # Core library files
└── client.ts          # Main entry point
```

### Java
```
sdk/
└── com/opensdk/[service]/
    ├── resource/      # Generated models and DTOs
    ├── service/       # Service interfaces and implementations  
    ├── lib/          # Core library files
    └── Client.java   # Main entry point
```

### PHP 
```
sdk/
└── OpenSDK/
    ├── Resource/     # Generated models and DTOs
    ├── Service/      # Service interfaces and implementations
    ├── Lib/         # Core library files  
    └── Client.php   # Main entry point
```

## HTTP Client Interface

The generated SDK requires an HTTP client implementation that varies by language:

### TypeScript
```typescript
interface OpenSDKHttpClient {
  execute<T>(
    method: string,
    path: string, 
    query: Record<string, any> | null,
    body: Record<string, any> | null
  ): Promise<T>;
}
```

### Java
```java
public interface OpenSDKHttpClient {
  <Body, Response> Response execute(RequestDescription<Body> request, Class<Response> responseType);
}
```

### PHP
```php
interface OpenSDKHttpClientInterface extends \Psr\Http\Client\ClientInterface {
  public function execute(string $method, string $path, ?array $query, ?array $body): mixed;
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Copyright 2025 N Md Faizaan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
