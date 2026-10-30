from pydantic import BaseModel, Field


class CompressRequest(BaseModel):
    # The upper bound is enforced in the route against Settings.max_text_chars,
    # so it can be configured without editing the schema.
    text: str = Field(min_length=1)


class CompressResponse(BaseModel):
    compressed: str
    original_chars: int
    compressed_chars: int
    # True when the model could not make the text shorter and the original is returned.
    unchanged: bool


class ErrorResponse(BaseModel):
    code: str
    message: str
