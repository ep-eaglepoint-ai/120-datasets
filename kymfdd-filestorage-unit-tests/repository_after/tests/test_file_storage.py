#!/usr/bin/python3
"""
Unit tests for FileStorage class
"""

import unittest
import os
import json
from repository_before.test_file_storage import FileStorage, BaseModel, User, State, City, Amenity, Place, Review
import repository_before.test_file_storage as storage_module


class TestFileStorage(unittest.TestCase):

    def setUp(self):
        self.test_file = "test_file.json"
        FileStorage._FileStorage__file_path = self.test_file
        FileStorage._FileStorage__objects = {}
        self.storage = FileStorage()
        storage_module.storage = self.storage

    def tearDown(self):
        if os.path.exists(self.test_file):
            os.remove(self.test_file)
        FileStorage._FileStorage__objects = {}
        self.assertFalse(os.path.exists("file.json"), "Req 3/4: real file.json must not be used")

    def test_all_returns_dict(self):
        """TC-01: Req 1 - all() returns the __objects dictionary"""
        self.assertIsInstance(self.storage.all(), dict)
        self.assertEqual(len(self.storage.all()), 0)

    def test_new_adds_object(self):
        """TC-02: Req 1 - new() adds an object to __objects"""
        bm = BaseModel()
        self.storage.new(bm)
        key = f"BaseModel.{bm.id}"
        self.assertIn(key, self.storage.all())
        self.assertEqual(self.storage.all()[key], bm)

    def test_new_adds_user(self):
        """TC-03: Req 1 - new() adds a User object (fixture only)"""
        user = User()
        self.storage.new(user)
        key = f"User.{user.id}"
        self.assertIn(key, self.storage.all())
        self.assertEqual(self.storage.all()[key], user)

    def test_save_creates_file(self):
        """TC-04: Req 3, 4 - save() serializes objects to temporary JSON file"""
        bm = BaseModel()
        self.storage.new(bm)
        self.storage.save()
        self.assertTrue(os.path.exists(self.test_file))
        with open(self.test_file, "r") as f:
            data = json.load(f)
            key = f"BaseModel.{bm.id}"
            self.assertIn(key, data)
            self.assertEqual(data[key]["id"], bm.id)
            self.assertEqual(data[key]["__class__"], "BaseModel")

    def test_reload_deserializes_objects(self):
        """TC-05: Req 4 - reload() deserializes objects from temporary file"""
        bm = BaseModel()
        bm_id = bm.id
        self.storage.save()
        
        FileStorage._FileStorage__objects = {}
        self.assertEqual(len(self.storage.all()), 0)
        
        self.storage.reload()
        key = f"BaseModel.{bm_id}"
        self.assertIn(key, self.storage.all())
        new_obj = self.storage.all()[key]
        self.assertIsInstance(new_obj, BaseModel)
        self.assertEqual(new_obj.id, bm_id)

    def test_reload_no_file(self):
        """TC-06: Req 6 - reload() handles missing file (independent/repeatable)"""
        try:
            self.storage.reload()
        except Exception as e:
            self.fail(f"reload() raised {type(e).__name__} unexpectedly!")

    def test_save_reload_multiple_objects(self):
        """TC-07: Req 6 - save/reload with multiple object types (isolation)"""
        u = User()
        s = State()
        self.storage.save()
        
        FileStorage._FileStorage__objects = {}
        self.storage.reload()
        
        self.assertIn(f"User.{u.id}", self.storage.all())
        self.assertIn(f"State.{s.id}", self.storage.all())
        self.assertIsInstance(self.storage.all()[f"User.{u.id}"], User)
        self.assertIsInstance(self.storage.all()[f"State.{s.id}"], State)

    def test_file_storage_file_path_private(self):
        """TC-08: Req 1 - __file_path is private and exists"""
        self.assertTrue(hasattr(FileStorage, "_FileStorage__file_path"))

    def test_file_storage_objects_private(self):
        """TC-09: Req 1 - __objects is private and exists"""
        self.assertTrue(hasattr(FileStorage, "_FileStorage__objects"))

if __name__ == "__main__":
    unittest.main()
