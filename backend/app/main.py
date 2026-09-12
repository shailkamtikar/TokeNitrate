from fastapi import FastAPI

app = FastAPI(title="TokeNitrate API")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
