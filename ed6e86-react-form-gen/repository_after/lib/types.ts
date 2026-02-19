export type InputType = 'text' | 'email' | 'tel' | 'url';

export type ChoiceType = 'radio' | 'checkbox';

export interface TextField {
  id: string;
  type: 'text';
  inputType: InputType;
  label: string;
  placeholder: string;
  required: boolean;
}

export interface ChoiceOption {
  id: string;
  label: string;
  value: string;
}

export interface ChoiceField {
  id: string;
  type: 'choice';
  choiceType: ChoiceType;
  legend: string;
  options: ChoiceOption[];
}

export type FormField = TextField | ChoiceField;

export interface FormData {
  title: string;
  description: string;
  fields: FormField[];
}

export type ActivePanel = 'none' | 'header' | 'text' | 'choice';
