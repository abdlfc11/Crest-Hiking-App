from pydantic import BaseModel

class SearchModel(BaseModel):
    search_input: str