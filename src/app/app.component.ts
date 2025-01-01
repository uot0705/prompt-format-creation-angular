import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms'; // FormsModuleをインポート
import { marked } from 'marked';

interface Field {
  id: number;
  title: string;
  content: string;
  expanded: boolean;
}

@Component({
  selector: 'app-root',
  standalone: true, // スタンドアロンコンポーネントを宣言
  imports: [FormsModule], // 必要なモジュールをここでインポート
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  private fieldObject: Field = {
    id: Date.now(),
    title: '',
    content: '',
    expanded: true,
  };

  protected mainQuestion = signal<string>('');
  protected fields = signal<Field[]>([this.fieldObject]);
  protected copySuccess = signal<boolean>(false);

  protected mainQuestionOutput = computed(() => marked.parse(this.mainQuestion()));
  protected fieldsOutputForDisplay = computed(() =>
    this.fields()
      .map(
        (field) => 
          `<div><h2>${field.title}</h2></div>
           <pre>${field.content}</pre>`
      )
      .join('')
  );
  
  protected mainQuestionOutputForDisplay = computed(() =>
    this.mainQuestion()
  );

  

  protected toggleCheckbox(type: string): void {
    this.resetForm();
    switch (type) {
      case 'question':
        this.mainQuestion.set('以下の質問に回答してください');
        this.addField('質問内容');
        break;
      case 'error':
        this.mainQuestion.set('以下のエラー内容を解決してください');
        this.addField('エラー内容');
        this.addField('出力内容', 'エラーの詳細情報:');
        break;
      case 'variableName':
        this.mainQuestion.set(
          '以下の変数の使い道に合う変数名を5個提案してください...'
        );
        this.addField('変数の使い道');
        this.addField('出力内容(以下の内容で5個)', '変数名:');
        break;
      case 'refactor':
        this.mainQuestion.set('以下のリファクタをしてください');
        this.addField();
        break;
    }
  }

  protected handleFieldChange(
    event: Event,
    fieldId: number,
    fieldType: 'title' | 'content'
  ): void {
    const target = event.target as HTMLInputElement | HTMLTextAreaElement;
    const newValue = target.value;

    this.updateField(fieldId, newValue, fieldType);
  }

  private updateField(
    fieldId: number,
    newValue: string,
    fieldType: 'title' | 'content'
  ): void {
    this.fields.update((fields) =>
      fields.map((field) =>
        field.id === fieldId ? { ...field, [fieldType]: newValue } : field
      )
    );
  }

  protected addField(title = '', content = ''): void {
    const newField: Field = {
      ...this.fieldObject, // fieldObjectをコピーしてベースとする
      id: Date.now(), // 新しいフィールド用のIDを生成
      title: title || this.fieldObject.title, // 引数で指定があればそれを使用
      content: content || this.fieldObject.content, // 引数で指定があればそれを使用
    };
  
    this.fields.update((fields) => [...fields, newField]); // 新しいフィールドを追加
  }

  protected removeField(field: Field): void {
    this.fields.update((fields) => fields.filter((f) => f.id !== field.id));
  }

  protected toggleField(field: Field): void {
    field.expanded = !field.expanded;
    this.fields.update((fields) => [...fields]);
  }

  protected moveFieldUp(field: Field): void {
    const index = this.fields().indexOf(field);
    if (index > 0) {
      const fields = [...this.fields()];
      [fields[index], fields[index - 1]] = [fields[index - 1], fields[index]];
      this.fields.set(fields);
    }
  }

  protected moveFieldDown(field: Field): void {
    const index = this.fields().indexOf(field);
    if (index < this.fields().length - 1) {
      const fields = [...this.fields()];
      [fields[index], fields[index + 1]] = [fields[index + 1], fields[index]];
      this.fields.set(fields);
    }
  }

  protected copyToClipboard(): void {
    const mainQuestionFormatted = this.mainQuestion().trim();
  
    const fieldsFormatted = this.fields()
      .map(
        (field) =>
          `## ${field.title}\n\`\`\`\n${field.content}\n\`\`\``
      )
      .join('\n\n');
  
    const outputText = `${mainQuestionFormatted}\n\n${fieldsFormatted}`;
    
    navigator.clipboard.writeText(outputText).then(() => {
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    });
  }
  

  private resetForm(): void {
    this.mainQuestion.set('');
    this.fields.set([]);
  }
}
