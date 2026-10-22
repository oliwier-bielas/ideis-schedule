# FizjoPlan

Jednostronicowa aplikacja Angular 22 + Angular Material dla studentów fizjoterapii. Rzeczywisty harmonogram pochodzi wyłącznie z [IDEIS, tok 1516](https://harmonogramy.ideis.pl/Plany/PlanyTokow/1516). Aplikacja nie używa danych demonstracyjnych.

## GitHub Pages — publikacja i synchronizacja co 3 godziny

Wersja Pages działa bez własnego serwera. Workflow `.github/workflows/pages.yml` uruchamia Puppeteer na GitHub Actions, pobiera cały semestr, zachowuje grupy **1, 1A, 1B i wykłady wspólne**, zapisuje JSON i publikuje gotowego Angulara wraz z planem. Aplikacja pokazuje zajęcia wybranej podgrupy 1A albo 1B wraz ze wspólnymi ćwiczeniami grupy 1 i wykładami.

### Jednorazowe uruchomienie na GitHubie

1. Utwórz **publiczne repozytorium** i prześlij kod, w tym katalog `.github/workflows/` oraz `scripts/`.
2. W repozytorium wybierz **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Wejdź w **Actions → Synchronize IDEIS and deploy Pages → Run workflow** na domyślnej gałęzi. Pierwszy push również uruchamia workflow; jeżeli Pages nie były wtedy jeszcze włączone, uruchom go ręcznie po kroku 2.
4. Po sukcesie link do strony znajdziesz w zadaniu `deploy` i w **Settings → Pages**.

Nie trzeba dodawać tokenów ani sekretów. Workflow korzysta z automatycznego `GITHUB_TOKEN`. Obsługuje dowolną nazwę domyślnej gałęzi (np. `master` lub `main`) i automatycznie dopasowuje ścieżkę `/<nazwa-repozytorium>/`, adres `*.github.io` albo domenę skonfigurowaną w Pages. Nie uruchamia publikacji z gałęzi roboczych.

- Harmonogram: `17 */3 * * *`, czyli **co 3 godziny, w 17. minucie**, według UTC. GitHub może opóźnić zadanie; nie jest to gwarancja uruchomienia o konkretnej minucie. [Dokumentacja harmonogramów](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
- Synchronizacja ma trzy próby. Błędny, pusty, nieaktualny lub nieprawidłowo przefiltrowany plan przerywa publikację. Ostatnia poprawna wersja strony nadal działa; dane nie są nadpisywane wynikiem błędu.
- W podsumowaniu zadania w Actions widać liczbę zajęć, zakres semestru i datę pobrania. Aplikacja pokazuje datę ostatniego pobrania; przycisk odświeżania wczytuje ostatnio opublikowany JSON. Otwarta karta otrzyma nowe dane po odświeżeniu lub ponownym wejściu.
- Sam JSON jest generowany podczas budowania i ignorowany przez Git. Zwykła synchronizacja nie dopisuje commitów do repozytorium.
- Publiczne repozytorium z Pages i standardowymi runnerami Actions może działać bez opłat. Kod i opublikowany plan są publiczne. [Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site), [Actions](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

### Cotygodniowy pusty commit w Pythonie

Workflow `.github/workflows/keepalive.yml` uruchamia standardowego Pythona w każdy poniedziałek o **05:37 UTC** i wywołuje `scripts/keepalive.py --push`. Tworzy pusty commit `chore: weekly schedule keepalive [skip ci]` na domyślnej gałęzi. Żaden plik aplikacji nie jest zmieniany; nie ma force-pusha ani przepisywania historii. Commit z automatycznego tokenu nie uruchamia kolejnej publikacji przez `push`; właściwa synchronizacja nadal działa według swojego harmonogramu.

To podtrzymuje aktywność repozytorium w związku z zasadą GitHuba dotyczącą wyłączania harmonogramów po 60 dniach bez aktywności. Jeżeli workflow był już wyłączony albo bot nie może pisać do chronionej gałęzi, wymaga odpowiednio ponownego włączenia lub dopuszczenia tej operacji w regułach repozytorium. Skrypt nie omija ochrony gałęzi. [Zasady harmonogramów](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

Skrypt bez `--push` wykonuje tylko podgląd. Testuje się na tymczasowych lokalnych repozytoriach, bez kontaktu z GitHubem:

```sh
python scripts/keepalive.py
python -m unittest discover -s scripts -p 'test_*.py'
```

### Lokalny podgląd wersji Pages

```sh
npm run sync:schedule
npm run build:pages
npm run preview:pages
```

Otwórz adres wypisany przez podgląd (port 4300). `PAGES_BASE_PATH` określa podkatalog; domyślnie `/`. Przykład w PowerShellu:

```powershell
$env:PAGES_BASE_PATH='/ideis-schedule/'
npm run build:pages
npm run preview:pages
```

Gdy podgląd działa, `node server/verify-browser.mjs --pages` sprawdza również statyczny JSON i link do strony głównej pod ścieżką repozytorium. Skrypt ustawia zegar testowy w obrębie rzeczywistego semestru i sprawdza zjazd 23–25 października 2026.

## Uruchomienie

Wymagany Node.js 24 i dostęp do internetu dla backendu.

```sh
npm install
npm start
```

Otwórz **http://127.0.0.1:4200/**. Jedno polecenie uruchamia Angular i backend Express na porcie 3001; żądania `/api/**` przechodzą przez proxy Angulara. Nie trzeba konfigurować CORS.

Puppeteer instaluje Chrome podczas instalacji zależności. Jeśli pobieranie przeglądarki było pominięte:

```sh
npx puppeteer browsers install chrome
```

Można też ustawić `PUPPETEER_EXECUTABLE_PATH` na istniejącą instalację Chrome. Pierwsze pobranie planu trwa zwykle kilka–kilkadziesiąt sekund, zależnie od odpowiedzi IDEIS. Interfejs pokazuje stan ładowania.

## Pobieranie i filtrowanie

W wersji lokalnej każde otwarcie aplikacji wywołuje `GET /api/schedule`. W wersji Pages przeglądarka odczytuje względny adres `data/schedule.json`, przygotowywany co 3 godziny przez Actions. W obu trybach ten sam scraper otwiera publiczną stronę w Puppeteer, odczytuje zakres opcji „Cały semestr”, ustawia daty w kontrolkach DevExpress i wywołuje oryginalne wyszukiwanie `FiltrujDane`. Czeka na `EndCallback`, po czym odczytuje wszystkie wiersze tabeli, łącznie z datami grupującymi, salami, prowadzącymi i uwagami. Równoległe żądania lokalnego backendu współdzielą jedno trwające pobranie.

Backend odrzuca obce grupy przed wysłaniem danych do przeglądarki. Przeglądarka następnie wybiera podgrupę zapisaną przez użytkownika:

| Oznaczenie w IDEIS                | Widok aplikacji                                    |
| --------------------------------- | -------------------------------------------------- |
| `Fizjoterapia Jmgr 1sem Ćw1N`     | Ćwiczenia, grupa 1                                 |
| `Fizjoterapia Jmgr 1sem Labor1AN` | Laboratoria, grupa 1A                              |
| `Fizjoterapia Jmgr 1sem Labor1BN` | Laboratoria, grupa 1B                              |
| `Fizjoterapia Jmgr 1sem WykN`     | Wykłady wspólne dla obu podgrup |

Grupy `Ćw2N`, `Labor2AN`, `Labor2BN` i nierozpoznane oznaczenia są odrzucane. Dopasowanie obejmuje cały token grupy, więc nie przepuszcza „10” ani „2A”. Frontend sprawdza dozwolone oznaczenia odpowiedzi i odrzuca niepełną kopię bez danych jednej z podgrup. Synchronizacja nadal odbywa się co 3 godziny i dostarcza dane obu podgrup w jednym pliku.

### Ustalenia dotyczące źródła

- Pobieranie rzeczywistego planu zostało sprawdzone **22 października 2026**: 200 bloków po filtrowaniu (56 wykładów wspólnych, 72 ćwiczenia grupy 1 oraz po 36 laboratoriów grup 1A i 1B), semestr od 11.09.2026 do 07.02.2027. Każda z podgrup widzi 164 bloki w semestrze, w tym 11 w weekend 23–25 października. Liczby mogą zmieniać się wraz z aktualizacjami źródła.
- Handler przycisku „Cały semestr” w IDEIS rozdziela wartość po dwóch ukośnikach wstecznych, podczas gdy HTML zawiera pojedyncze. Bez obejścia daty pozostały na bieżącym dniu i wynik był pusty. Scraper odczytuje zakres bezpośrednio z HTML i ustawia daty przez API kontrolek `MVCxDataOd` / `MVCxDataDo`.
- Zweryfikowano również publiczny eksport `WydrukTokuCsv/1516`. Eksport pomija **prowadzących i formę zajęć** oraz nie zachowuje poprawnie części polskich znaków, dlatego źródłem pełnych danych aplikacji jest tabela odczytywana przez Puppeteer. Przycisk „Eksportuj CSV” generuje UTF-8 z BOM z przefiltrowanego weekendu, z prowadzącymi i salami.
- Brak nierozwiązanych przeszkód w pobieraniu podczas weryfikacji. Integracja zależy od publicznej strony i jej struktury. Zmiana selektorów lub kolumn powoduje czytelny błąd z nazwą etapu, zamiast udawać dzień wolny.

## Zachowanie interfejsu

- Neutralny grafit: tło `#101217`, karty `#191C23`, aktywne zakładki `#272C36`; pastelowy kolor przypisany na stałe do nazwy przedmiotu. Psychologia jest lawendowa, dietetyka szałwiowa, anatomia błękitna. Ten sam przedmiot zachowuje kolor we wszystkich terminach, formach zajęć i filtrach. Pozostałe przedmioty mają deterministyczne przypisanie z tej samej palety.
- Przy pierwszym wejściu ekran wyboru grupy 1A / 1B. Wybór trafia do `localStorage` pod kluczem `fizjoplan:group:v1`, a przy następnym wejściu jest odczytywany przed pokazaniem planu. Brakujący lub nieprawidłowy wybór ponownie pokazuje ekran wyboru. W nagłówku po prawej jest select do zmiany grupy; aktualizuje listę, liczniki, status i eksport CSV. Obie grupy zachowują ćwiczenia grupy 1 i wykłady wspólne. Przy zablokowanym zapisie wybór działa na czas otwartej strony, z informacją o braku możliwości zapamiętania.
- Lekki nagłówek FizjoPlan i kompaktowa karta najbliższych zajęć z datą podaną raz. Podczas zajęć pokazuje „Trwa teraz”, pozostałe minuty i pasek postępu. Stan aktualizuje się co 15 sekund według strefy `Europe/Warsaw`, niezależnie od strefy komputera.
- Jedna nawigacja zjazdu: zakres i strzałki, a na telefonie równe zakładki Pt / Sob / Ndz. Domyślnie nadchodzący weekend od poniedziałku do czwartku, bieżący od piątku do niedzieli. „Najbliższy zjazd” pojawia się przy przeglądaniu innych terminów. Nawigacja nie zmienia rzeczywistego statusu na górze.
- Na komputerze trzy kolumny dni; na telefonie jeden wybrany dzień, marginesy 16 px, odstępy 12 px i karty bez zewnętrznej ramki. Domyślnie dzisiejszy dzień lub pierwszy dzień z zajęciami. Zakładki obsługują strzałki, Home i End.
- Filtr „Typ zajęć” korzysta z menu Angular Material; wybrany typ można wyczyścić bez zmiany dnia. Eksport całego zjazdu do CSV, odświeżenie i link do IDEIS są w menu dodatkowych akcji obok tytułu.
- Kliknięcie karty rozwija szczegóły w miejscu: prowadzącego, czas trwania, grupę, bloki godzinowe, zaliczenie, uwagi i mapę. Kolejne bloki tego samego przedmiotu, prowadzącego, formy, grupy i miejsca łączą się w jedną kartę. Rozwinięcie pokazuje osobno „Blok 1”, przerwę i „Blok 2” z oryginalnymi godzinami. Przerwa nie wlicza się do czasu zajęć ani statusu „Trwa teraz”. Łączenie odbywa się przed filtrowaniem, bez zmiany danych eksportu CSV. Zajęcia zdalne i odwołane mają jawne oznaczenia.
- W szczegółach zajęć dla S55 (Gmach Główny, ul. Strzegomska 55), S47 (ul. Strzegomska 47) i W1 (ul. Wagonowa 1) jest klikalna mapka oraz przycisk „Nawiguj w Google Maps”. Wszystkie adresy we Wrocławiu. Podgląd pochodzi z OpenStreetMap, a nawigacja korzysta z [uniwersalnych linków Google Maps](https://developers.google.com/maps/documentation/urls/get-started) bez klucza API. Celem trasy są zweryfikowane współrzędne konkretnego budynku, ponieważ Google potrafi rozpoznać adres tekstowy jako samą ulicę i pominąć numer. Pełny adres pozostaje widoczny w aplikacji. Na telefonie link otwiera aplikację Google Maps, jeśli jest zainstalowana; inaczej mapy w przeglądarce. Google Maps korzysta z pozycji urządzenia, a przy jej braku pokazuje podgląd trasy. Zajęcia zdalne i nierozpoznane lub niejednoznaczne budynki nie otrzymują mapy ani zgadywanego adresu.
- Osobne stany ładowania, błędu, pustego dnia, braku zajęć wybranego typu i weekendu poza semestrem.
- Po błędzie pobrania można wyświetlić ostatnią poprawną kopię z `localStorage` (`fizjoplan:schedule:v2`); banner wyraźnie informuje o możliwej nieaktualności i dacie pobrania. Kopia obejmuje obie podgrupy i nadal jest filtrowana według wyboru użytkownika. Stara kopia v1 zawierająca tylko 1A nie jest używana jako plan 1B. Kopia nigdy nie zastępuje próby odświeżenia przy otwarciu strony.
- Nawigacja klawiaturą, etykiety przycisków, focus, ograniczone animacje przy `prefers-reduced-motion`. Font Inter z Google Fonts ma lokalny fallback systemowy.

## Testy i kompilacja

```sh
npm test
npm run test:server
npm run build
```

Testy obejmują odrzucanie innych grup, rozdzielenie planu 1A i 1B, zapis i odczyt wyboru, błędny lub zablokowany storage, normalizację rzeczywistych kolumn IDEIS, odwołane i zdalne zajęcia, granice godzin, statusy dnia, wybór weekendu i zmianę czasu w Warszawie. Testy prezentacji sprawdzają stałość kolorów, łączenie bloków, zachowanie oryginalnych godzin i rozróżnienie przerwy od zajęć.

Po uruchomieniu `npm start` można dodatkowo uruchomić:

```sh
node server/verify-browser.mjs
```

Test Puppeteer pobiera rzeczywisty plan przez aplikację, sprawdza pierwsze wejście, zapamiętanie grupy po przeładowaniu, select, rozdzielenie eksportów A/B, rozwijanie bloków i przerw, stałość kolorów, filtry, mapy, status trwających zajęć dla wybranej grupy, nawigację, widoki 390 i 320 px bez poziomego przewijania oraz błąd z zapisaną kopią i bez niej. Zegar testowy jest ustawiany na 22–24 października 2026, w obrębie rzeczywistego semestru. Zrzuty i pobrane dane testowe trafiają do ignorowanego `tmp/`. Opcja `--cached` używa wyłącznie wcześniej pobranego, rzeczywistego `tmp/verified-schedule.json`, aby powtórzyć weryfikację wyglądu bez dodatkowych zapytań do IDEIS.

## Wersja produkcyjna lokalnie

```sh
npm run build
npm run start:prod
```

Standardowy build (bez konfiguracji Pages) działa z lokalnym backendem, który serwuje aplikację oraz API pod **http://127.0.0.1:3001/**. Port można zmienić przez `PORT`. Statyczny hosting wykorzystuje osobne `npm run build:pages` i workflow opisany na początku dokumentu. Zmiany w projekcie są przygotowane lokalnie; publikacja na GitHubie wymaga przesłania ich do repozytorium.
