import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  question = '';
  answer = '';
  loading = false;
  error = '';

  updateQuestion(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.question = input.value;
  }

  async askQuestion(event: Event): Promise<void> {
    event.preventDefault();

    if (!this.question.trim()) {
      this.error = 'Please enter a question first.';
      return;
    }

    this.loading = true;
    this.answer = '';
    this.error = '';

    try {
      const response = await fetch('http://127.0.0.1:3000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: this.question })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Unable to get an answer.');
      }

      this.answer = data.answer;
      console.log('AI answer received:', data.answer);
console.log('Angular answer variable:', this.answer);
    } catch (err) {
      this.error =
        err instanceof Error
          ? err.message
          : 'Could not connect to the backend.';
    } finally {
      this.loading = false;
    }
  }
}