#include <WiFi.h>
#include <WebServer.h>
#include <LittleFS.h>

const char* ssid = "Nama WIFI";
const char* password = "pass";

WebServer server(80);

// Data 6 ruangan & fan (hubungkan dengan pembacaan sensor/aktuator Anda)
float suhuRuang[6]   = {37.2, 36.8, 37.5, 38.0, 36.9, 37.1};
int cahayaRuang[6]   = {65, 60, 70, 55, 65, 60};
int statusFan        = 1; // 1 = ON, 0 = OFF

String getContentType(String filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css"))  return "text/css";
  if (filename.endsWith(".js"))   return "application/javascript";
  if (filename.endsWith(".json")) return "application/json";
  if (filename.endsWith(".png"))  return "image/png";
  if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  return "text/plain";
}

// Mengubah %20 pada URL gambar (misal: dht%2022.jpg) menjadi spasi asli
String urlDecode(String str) {
  String decoded = "";
  char temp[] = "0x00";
  unsigned int len = str.length();
  for (unsigned int i = 0; i < len; i++) {
    if (str[i] == '%' && i + 2 < len) {
      temp[2] = str[i + 1];
      temp[3] = str[i + 2];
      decoded += (char)strtol(temp, NULL, 16);
      i += 2;
    } else if (str[i] == '+') {
      decoded += ' ';
    } else {
      decoded += str[i];
    }
  }
  return decoded;
}

bool handleFileRead(String path) {
  path = urlDecode(path);
  if (path.endsWith("/")) path += "index.html";
  String contentType = getContentType(path);

  if (LittleFS.exists(path)) {
    File file = LittleFS.open(path, "r");
    server.streamFile(file, contentType);
    file.close();
    return true;
  }
  return false;
}

void handleApiData() {
  String json = "{\"rooms\":[";
  for (int i = 0; i < 6; i++) {
    json += "{\"suhu\":" + String(suhuRuang[i], 1) + ",\"cahaya\":" + String(cahayaRuang[i]) + "}";
    if (i < 5) json += ",";
  }
  json += "],\"fan\":" + String(statusFan) + "}";

  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.send(200, "application/json", json);
}

void setup() {
  Serial.begin(115200);

  if (!LittleFS.begin(true)) {
    Serial.println("Gagal mount LittleFS!");
    return;
  }

  WiFi.begin(ssid, password);
  Serial.print("Menghubungkan ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Terhubung!");
  Serial.print("Buka website di: http://");
  Serial.println(WiFi.localIP());

  server.on("/api/data", HTTP_GET, handleApiData);

  server.onNotFound([]() {
    if (!handleFileRead(server.uri())) {
      server.send(404, "text/plain", "404: File tidak ditemukan");
    }
  });

  server.begin();
}

void loop() {
  server.handleClient();
}
