# AVIO — All-in-one booking

## הרצה מקומית

```bash
npm install
npm run dev
```

## פריסה ל-GitHub Pages

1. ודא ששם הריפו הוא `avio-app` (או עדכן את `base` ב-`vite.config.js` ואת הנתיבים ב-`index.html` ו-`manifest.json` לשם החדש).
2. ב-GitHub: **Settings → Pages → Source** בחר **GitHub Actions**.
3. עשה `git push` ל-branch `main`. ה-workflow תחת `.github/workflows/deploy.yml` יבנה את הפרויקט ויפרסם אותו אוטומטית.
4. האתר יהיה זמין ב-`https://<username>.github.io/avio-app/`.

## התקנה על מסך הבית (iOS / Android)

- **iOS (Safari)**: פתח את הכתובת → כפתור שיתוף → "הוסף למסך הבית".
- **Android (Chrome)**: פתח את הכתובת → תפריט (⋮) → "התקן אפליקציה" / "הוסף למסך הבית".

האפליקציה מוגדרת כ-PWA מלא (manifest + service worker), כך שתיפתח במסך מלא ללא סרגלי דפדפן, עם אייקון ייעודי, ותעבוד גם במצב אופליין חלקי.
