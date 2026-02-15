import { storage } from './storage.js';

export class Stats {
  constructor(){
    this.key = 'overallStats';
    this.data = storage.get(this.key, {total:0, correct:0, wrong:0});
    this.listeners = new Set();
  }
  onChange(fn){ this.listeners.add(fn); }
  emit(){ for(const fn of this.listeners) fn(this.snapshot()); }
  snapshot(){
    const {total, correct, wrong} = this.data;
    return { total, correct, wrong, accuracy: total? (correct/total):0 };
  }
  record(ok){
    this.data.total += 1;
    if(ok) this.data.correct += 1; else this.data.wrong += 1;
    storage.set(this.key, this.data);
    this.emit();
  }
  reset(){
    this.data = {total:0, correct:0, wrong:0};
    storage.set(this.key, this.data);
    this.emit();
  }
}
