const int btn1 = 2;
const int btn2 = 3;

void setup() {
  Serial.begin(9600);
  pinMode(btn1, INPUT_PULLUP);
  pinMode(btn2, INPUT_PULLUP);
}

void loop() {
  if (digitalRead(btn1) == LOW) {
    Serial.println("BTN1");
    delay(300); // debounce
  }
  if (digitalRead(btn2) == LOW) {
    Serial.println("BTN2");
    delay(300);
  }
}