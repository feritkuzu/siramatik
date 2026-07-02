import serial
import keyboard
import time

ser = serial.Serial('COM3', 9600)
time.sleep(2)

while True:
    line = ser.readline().decode('utf-8').strip()
    if line == "BTN1":
        keyboard.press_and_release('enter')
    elif line == "BTN2":
        keyboard.press_and_release('escape')
