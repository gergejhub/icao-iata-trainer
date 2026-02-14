export class Stats{
  constructor(storage){
    this.storage = storage;
    this.listeners = [];
    this.load();
  }
  onChange(fn){ this.listeners.push(fn); }
  emit(){ for (const fn of this.listeners) fn(); }

  load(){
    this.totalAnswered = this.storage.get('stats:totalAnswered',0);
    this.totalCorrect  = this.storage.get('stats:totalCorrect',0);
    this.streak        = this.storage.get('stats:streak',0);
    this.bestStreak    = this.storage.get('stats:bestStreak',0);
  }
  save(){
    this.storage.set('stats:totalAnswered', this.totalAnswered);
    this.storage.set('stats:totalCorrect', this.totalCorrect);
    this.storage.set('stats:streak', this.streak);
    this.storage.set('stats:bestStreak', this.bestStreak);
    this.emit();
  }
  reset(){
    this.totalAnswered=0; this.totalCorrect=0; this.streak=0; this.bestStreak=0;
    this.save();
  }
  answer(isCorrect){
    this.totalAnswered += 1;
    if (isCorrect){
      this.totalCorrect += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.streak = 0;
    }
    this.save();
  }
  snapshot(){
    const acc = this.totalAnswered ? Math.round((this.totalCorrect/this.totalAnswered)*100) : 0;
    return { totalAnswered:this.totalAnswered, totalCorrect:this.totalCorrect, accuracyPct: acc, streak: this.streak, bestStreak: this.bestStreak };
  }
}
