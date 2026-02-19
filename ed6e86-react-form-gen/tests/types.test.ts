import type { FormData, TextField, ChoiceField, InputType, ChoiceType } from '@/lib/types';

describe('Type definitions', () => {
  describe('TextField', () => {
    it('should accept valid text field', () => {
      const field: TextField = {
        id: '1',
        type: 'text',
        inputType: 'email',
        label: 'Email',
        placeholder: 'Enter email',
        required: true,
      };

      expect(field.type).toBe('text');
      expect(field.inputType).toBe('email');
    });

    it('should accept all input types', () => {
      const types: InputType[] = ['text', 'email', 'tel', 'url'];
      
      types.forEach((inputType) => {
        const field: TextField = {
          id: '1',
          type: 'text',
          inputType,
          label: 'Test',
          placeholder: 'Test',
          required: false,
        };
        expect(field.inputType).toBe(inputType);
      });
    });
  });

  describe('ChoiceField', () => {
    it('should accept valid choice field', () => {
      const field: ChoiceField = {
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
        ],
      };

      expect(field.type).toBe('choice');
      expect(field.choiceType).toBe('radio');
      expect(field.options).toHaveLength(1);
    });

    it('should accept both choice types', () => {
      const types: ChoiceType[] = ['radio', 'checkbox'];
      
      types.forEach((choiceType) => {
        const field: ChoiceField = {
          id: '1',
          type: 'choice',
          choiceType,
          legend: 'Test',
          options: [],
        };
        expect(field.choiceType).toBe(choiceType);
      });
    });
  });

  describe('FormData', () => {
    it('should accept valid form data', () => {
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
          {
            id: '2',
            type: 'choice',
            choiceType: 'checkbox',
            legend: 'Select options',
            options: [
              {
                id: 'opt1',
                label: 'Option 1',
                value: 'option-1',
              },
            ],
          },
        ],
      };

      expect(formData.title).toBe('Test Form');
      expect(formData.fields).toHaveLength(2);
    });
  });
});
