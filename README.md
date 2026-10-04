# 🌄 Panorama

Mon premier réseau social : on partage des photos, on like, on commente.

## Lancer

```bash
npm install
npm start
```

Puis ouvre http://localhost:3000 (change le port avec `PORT=4000 npm start`). Prérequis : Node.js 18+.

Au premier lancement, quelques photos de démonstration sont créées pour que le fil ne soit pas vide.

## Fonctionnalités

- **Fil en mosaïque** avec fond animé
- **Partage de photos** : glisser-déposer ou parcourir, légende optionnelle (jpg, png, gif, webp, 10 Mo max)
- **Likes** : bouton ❤ ou double-clic sur la photo
- **Commentaires** sur chaque photo
- **Pseudo** sans mot de passe (gardé dans le navigateur) ; clique sur un auteur pour voir ses photos
- Suppression de ses propres photos

## Technique

Express + multer côté serveur, HTML/CSS/JS pur côté client, aucune base à installer : les données sont dans `data/db.json` et les images dans `uploads/` (ignorés par git).

> Ébauche : le pseudo n'est pas authentifié, n'importe qui peut donc se faire passer pour quelqu'un d'autre. À remplacer par de vrais comptes avant toute mise en ligne.

## Idées pour la suite

Vrais comptes (inscription/connexion), abonnements, albums, notifications.
