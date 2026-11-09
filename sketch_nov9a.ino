#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // Install library "ArduinoJson" by Benoit Blanchon

const char* ssid = "Nama_WiFi_Anda";
const char* password = "Password_WiFi_Anda";
const char* scriptURL = "URL_ANDA_DISINI/exec"; // Ganti dengan URL /exec Anda

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Menghubungkan ke WiFi...");
  }
  Serial.println("WiFi Terhubung!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(scriptURL);
    http.addHeader("Content-Type", "application/json"); // ESP32 tidak perlu trik text/plain

    // Siapkan data (ganti dengan pembacaan sensor asli Anda)
    StaticJsonDocument<1024> doc;
    JsonArray rooms = doc.createNestedArray("rooms");
    for (int i = 0; i < 6; i++) {
      JsonObject room = rooms.createNestedObject();
      room["suhu"] = 37.5 + (random(0, 20) / 10.0); // Simulasi
      room["cahaya"] = random(30, 90);              // Simulasi
    }
    String jsonData;
    serializeJson(doc, jsonData);

    int httpResponseCode = http.POST(jsonData);
    Serial.print("Response code: ");
    Serial.println(httpResponseCode);

    http.end();
  } else {
    Serial.println("WiFi Terputus");
  }
  delay(3000); // Kirim setiap 3 detik
}