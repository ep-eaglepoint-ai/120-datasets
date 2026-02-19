import { saveFormData, loadFormData } from '@/lib/formStorage';
import type { FormData } from '@/lib/types';

describe('formStorage', () => {
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    localStorageMock = {};
    
    global.Storage.prototype.getItem = jest.fn((key: string) => localStorageMock[key] || null);
    global.Storage.prototype.setItem = jest.fn((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    global.Storage.prototype.removeItem = jest.fn((key: string) => {
      delete localStorageMock[key];
    });
    global.Storage.prototype.clear = jest.fn(() => {
      localStorageMock = {};
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('saveFormData', () => {
    it('should save form data to localStorage', () => {
      const formData: FormData = {
        title: 'Test Form',
        description: 'Test Description',
        fields: [
          {
            id: '1',
            type: 'text',
            inputType: 'email',
            label: 'Email',
            placeholder: 'Enter email',
            required: true,
          },
        ],
      };

      saveFormData(formData);

      expect(localStorage.setItem).toHaveBeenCalledWith('formData', JSON.stringify(formData));
      
      const stored = localStorageMock['formData'];
      expect(stored).toBeDefined();
      
      const parsed = JSON.parse(stored);
      expect(parsed.title).toBe('Test Form');
      expect(parsed.description).toBe('Test Description');
      expect(parsed.fields).toHaveLength(1);
    });

    it('should handle localStorage errors gracefully', () => {
      const formData: FormData = {
        title: 'Test',
        description: 'Test',
        fields: [],
      };

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      global.Storage.prototype.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => saveFormData(formData)).not.toThrow();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('loadFormData', () => {
    it('should load valid form data from localStorage', () => {
      const formData: FormData = {
        title: 'Test Form',
        description: 'Test Description',
        fields: [
          {
            id: '1',
            type: 'text',
            inputType: 'text',
            label: 'Name',
            placeholder: 'Enter name',
            required: false,
          },
        ],
      };

      localStorageMock['formData'] = JSON.stringify(formData);
      const loaded = loadFormData();

      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.title).toBe('Test Form');
        expect(loaded.description).toBe('Test Description');
        expect(loaded.fields).toHaveLength(1);
      }
    });

    it('should return null when no data exists', () => {
      const loaded = loadFormData();
      expect(loaded).toBeNull();
    });

    it('should return null for invalid data', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock['formData'] = 'invalid json';
      const loaded = loadFormData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should return null for data with invalid structure', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      localStorageMock['formData'] = JSON.stringify({ invalid: 'data' });
      const loaded = loadFormData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should validate text field structure', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const invalidData = {
        title: 'Test',
        description: 'Test',
        fields: [
          {
            id: '1',
            type: 'text',
            inputType: 'invalid',
            label: 'Test',
            placeholder: 'Test',
            required: true,
          },
        ],
      };

      localStorageMock['formData'] = JSON.stringify(invalidData);
      const loaded = loadFormData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should validate choice field structure', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const invalidData = {
        title: 'Test',
        description: 'Test',
        fields: [
          {
            id: '1',
            type: 'choice',
            choiceType: 'invalid',
            legend: 'Test',
            options: [],
          },
        ],
      };

      localStorageMock['formData'] = JSON.stringify(invalidData);
      const loaded = loadFormData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should validate choice field options', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const invalidData = {
        title: 'Test',
        description: 'Test',
        fields: [
          {
            id: '1',
            type: 'choice',
            choiceType: 'radio',
            legend: 'Test',
            options: [
              {
                id: '1',
                label: 'Option 1',
                value: 'opt1',
              },
              {
                invalid: 'option',
              },
            ],
          },
        ],
      };

      localStorageMock['formData'] = JSON.stringify(invalidData);
      const loaded = loadFormData();
      expect(loaded).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should load form with choice fields', () => {
      const formData: FormData = {
        title: 'Test Form',
        description: 'Test Description',
        fields: [
          {
            id: '1',
            type: 'choice',
            choiceType: 'radio',
            legend: 'Choose option',
            options: [
              {
                id: 'opt1',
                label: 'Option 1',
                value: 'option-1',
              },
              {
                id: 'opt2',
                label: 'Option 2',
                value: 'option-2',
              },
            ],
          },
        ],
      };

      localStorageMock['formData'] = JSON.stringify(formData);
      const loaded = loadFormData();

      expect(loaded).not.toBeNull();
      if (loaded) {
        expect(loaded.fields[0].type).toBe('choice');
        if (loaded.fields[0].type === 'choice') {
          expect(loaded.fields[0].options).toHaveLength(2);
        }
      }
    });
  });
});
