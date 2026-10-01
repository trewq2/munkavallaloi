# Munkavállalói ismeretek – GitHub Pages változat

Ez a verzió **PHP és adatbázis nélkül**, közvetlenül GitHub Pages-en fut. A feltöltött 26 feladatot használja, összesen 30 ponttal.

## Mit tud?

- kérdések véletlenszerű sorrendje minden új kitöltésnél;
- válaszlehetőségek véletlenszerű sorrendje;
- egyszerre csak egy kérdés látható;
- alapbeállítás szerint nincs visszalépés a már lezárt kérdéshez;
- 15 perces időkorlát, ami frissítés után is folytatódik;
- ablak-/lapelhagyások számlálása;
- teljes képernyős mód kérése;
- másolás, jobb klikk és több gyakori fejlesztői gyorsbillentyű tiltása;
- automatikus 30 pontos értékelés és százalék/osztályzat;
- saját megoldások megjelenítése;
- saját eredmény PDF-be mentése;
- a helyes válaszok alapból nem jelennek meg a tanulónak;
- a befejezett teszt ugyanabban a böngészőben alapból nem indítható újra.

## Publikálás GitHub Pages-en

1. A GitHubon hozz létre egy új repositoryt, például `munkavallaloi-ismeretek` néven.
2. A ZIP tartalmát töltsd fel a repository **gyökerébe**. Fontos, hogy az `index.html` közvetlenül a repository gyökerében legyen.
3. GitHub: **Settings → Pages**.
4. A **Build and deployment / Source** résznél válaszd a **Deploy from a branch** lehetőséget.
5. Branch: `main`, mappa: `/(root)`, majd **Save**.
6. Néhány perc után az oldal általában ezen a címen érhető el:
   `https://FELHASZNALONEV.github.io/munkavallaloi-ismeretek/`

## Beállítások

Az `assets/config.js` fájlban módosítható:

- `TIME_LIMIT_MINUTES`: időkorlát;
- `GRADE_THRESHOLDS`: osztályzathatárok;
- `REVEAL_CORRECT_ANSWERS`: helyes válaszok mutatása a végén;
- `ALLOW_BACK_NAVIGATION`: visszalépés engedélyezése;
- `ALLOW_NEW_ATTEMPT_AFTER_FINISH`: új kitöltés engedélyezése ugyanazon böngészőben;
- `CLIENT_LOCKDOWN`: másolás/jobb klikk/gyorsbillentyűk tiltása;
- `TRACK_VISIBILITY_CHANGES`: lapváltások számlálása.

## Fontos: GitHub Pages biztonsági korlát

A GitHub Pages csak statikus HTML/CSS/JavaScript fájlokat szolgál ki, ezért **nem futtat PHP-t és nincs szerveroldali adatbázisa**. Emiatt:

- nincs központi tanári eredménylista;
- a megoldókulcs technikailag a böngészőbe kerül, ezért egy fejlesztői eszközökhöz értő tanuló elegendő idővel visszafejtheti;
- a böngészős tiltások csaláscsökkentők, de nem jelentenek valódi vizsgabiztonságot;
- a tanulói PDF kliensoldalon készül, ezért önmagában nem tekinthető kriptográfiailag hitelesített bizonyítéknak.

A helyes válaszok nincsenek `correct: true` formában a forrásban; a kliens hash-alapú ellenőrzést használ, ami az egyszerű forráskód-nézegetést megnehezíti, de nem teszi a rendszert feltörhetetlenné.

Ha olyan változat kell, ahol **a megoldókulcs valóban szerveroldalon marad és a tanári eredmények központilag gyűlnek**, a GitHub csak a forráskód tárolására használható, és külön backend tárhely szükséges. A korábbi PHP-verzió erre alkalmas XAMPP/WAMP/VPS vagy PHP-t futtató webtárhelyen.

## Új kitöltés engedélyezése teszteléshez

Tesztelés közben állítsd ezt:

```js
ALLOW_NEW_ATTEMPT_AFTER_FINISH: true
```

vagy töröld a böngészőben az oldal helyi adatait / localStorage-ját.

## Fájlok

- `index.html` – tanulói oldal
- `assets/config.js` – beállítások
- `assets/questions.js` – feladatok és kliensoldali ellenőrzési adatok
- `assets/app.js` – tesztlogika
- `assets/report.js` – PDF-generálás külső könyvtár nélkül
- `assets/style.css` – megjelenés
