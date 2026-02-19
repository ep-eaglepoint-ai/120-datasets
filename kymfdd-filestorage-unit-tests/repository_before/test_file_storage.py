#!/usr/bin/python3
"""
Single-file implementation of FileStorage, BaseModel,
and all model classes (User, State, City, Place, Amenity, Review)
"""

import json
from uuid import uuid4
from datetime import datetime


# =====================
# BaseModel
# =====================
class BaseModel:
    TIME_FORMAT = "%Y-%m-%dT%H:%M:%S.%f"

    def __init__(self, *args, **kwargs):
        self.id = str(uuid4())
        self.created_at = datetime.today()
        self.updated_at = self.created_at

        if kwargs:
            for key, value in kwargs.items():
                if key in ("created_at", "updated_at"):
                    setattr(self, key, datetime.strptime(value, self.TIME_FORMAT))
                elif key != "__class__":
                    setattr(self, key, value)
        else:
            storage.new(self)

    def __str__(self):
        return f"[{self.__class__.__name__}] ({self.id}) {self.__dict__}"

    def save(self):
        self.updated_at = datetime.today()
        storage.save()

    def to_dict(self):
        obj = self.__dict__.copy()
        obj["__class__"] = self.__class__.__name__
        obj["created_at"] = self.created_at.isoformat()
        obj["updated_at"] = self.updated_at.isoformat()
        return obj


# =====================
# Model Classes
# =====================
class User(BaseModel):
    email = ""
    password = ""
    first_name = ""
    last_name = ""


class State(BaseModel):
    name = ""


class City(BaseModel):
    state_id = ""
    name = ""


class Amenity(BaseModel):
    name = ""


class Place(BaseModel):
    city_id = ""
    user_id = ""
    name = ""
    description = ""
    number_rooms = 0
    number_bathrooms = 0
    max_guest = 0
    price_by_night = 0
    latitude = 0.0
    longitude = 0.0
    amenity_ids = []


class Review(BaseModel):
    place_id = ""
    user_id = ""
    text = ""


# =====================
# FileStorage
# =====================
class FileStorage:
    __file_path = "file.json"
    __objects = {}

    # Explicit class registry (since everything is in this file)
    classes = {
        "BaseModel": BaseModel,
        "User": User,
        "State": State,
        "City": City,
        "Amenity": Amenity,
        "Place": Place,
        "Review": Review,
    }

    def all(self):
        return FileStorage.__objects

    def new(self, obj):
        key = f"{obj.__class__.__name__}.{obj.id}"
        FileStorage.__objects[key] = obj

    def save(self):
        with open(FileStorage.__file_path, "w") as f:
            json.dump(
                {k: v.to_dict() for k, v in FileStorage.__objects.items()},
                f
            )

    def reload(self):
        try:
            with open(FileStorage.__file_path, "r") as f:
                data = json.load(f)

            for obj in data.values():
                cls = FileStorage.classes.get(obj["__class__"])
                if cls:
                    self.new(cls(**obj))

        except FileNotFoundError:
            pass
