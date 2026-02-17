# Deployment Diagram

```mermaid
flowchart LR
  Browser --> Nginx[Optional Reverse Proxy]
  Nginx --> API[App Container]
  API --> Redis[(Redis)]
  API --> SQLite[(SQLite/Volume)]
  Worker[Worker Container] --> Redis
  Worker --> SQLite
  Worker --> GitHub[GitHub API]
  Worker --> Gemini[Gemini API]
```
