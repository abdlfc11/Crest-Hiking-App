from pydantic import BaseModel

class SettingsModel(BaseModel):
    settings_dict : dict