# Spécification de sécurité Firestore (`security_spec.md`)

## 1. Invariants de données (Master Gate & Intégrité)
1. **Authentification vérifiée obligatoire** : Aucune lecture ni écriture anonyme ou non vérifiée (`request.auth != null && request.auth.token.email_verified == true`).
2. **Intégrité des identifiants (ID Poisoning Guard)** : Tout identifiant de document (`siteId`, `zoneId`, `personId`, `memberUid`, `inviteCode`) doit respecter `^[a-zA-Z0-9_-]+$` et `size() <= 128`.
3. **Appartenance au site (Master Gate)** : Les sous-collections `/sites/{siteId}/zones/{zoneId}` et `/sites/{siteId}/people/{personId}` vérifient la présence/propriété du document parent `/sites/{siteId}` pour `get`, `create`, `update`, `delete`.
4. **Validation stricte des numéros internes** : `Person.internalNumber` doit strictement correspondre à `^\d{4}(/\d{4})?$`.
5. **Immutabilité et horodatage serveur** : `ownerUid` et `createdAt` sont immuables après création ; `createdAt` et `updatedAt` doivent égaler `request.time`.
6. **Requêtes `list` sécurisées sans lookups** : Aucune fonction `get()` ou `exists()` dans `allow list` ; vérification directe sur `resource.data.ownerUid`, `resource.data.sharedUids` (borné `<= 10`) ou l'administrateur vérifié (`service.qse.33450@gmail.com`).
7. **Isolation PII** : Aucune adresse e-mail ou donnée personnelle privée n'est stockée dans les documents `SiteMember` partagés.

## 2. Les 12 charges d'attaque (« Dirty Dozen ») devant retourner `PERMISSION_DENIED`
1. **Lecture anonyme** : `GET /sites/site-principal` sans authentification (`auth == null`).
2. **E-mail non vérifié** : `CREATE /sites/s1` avec `email_verified: false` (même si l'e-mail usurpe l'administrateur).
3. **Injection de champ fantôme (Shadow Update)** : `UPDATE /sites/s1` ajoutant `isAdmin: true` ou `ghostField: 1`.
4. **Usurpation de `ownerUid`** : `CREATE /sites/s1` avec `ownerUid: "autre_uid"` différent de `request.auth.uid`.
5. **Modification d'un champ immuable** : `UPDATE /sites/s1` changeant `ownerUid` ou `createdAt`.
6. **Horodatage falsifié** : `CREATE /sites/s1/people/p1` avec `updatedAt` différent de `request.time`.
7. **Numéro interne invalide** : `CREATE /sites/s1/people/p1` avec `internalNumber: "123"` (3 chiffres) ou `"abcd"`.
8. **Rôle non autorisé dans l'array** : `CREATE /sites/s1/people/p1` avec `roles: ["SUPER_ADMIN"]`.
9. **Tableau `sharedUids` hors limite (DoS)** : `UPDATE /sites/s1` avec `sharedUids` contenant 15 éléments (`> 10`).
10. **ID empoisonné (Resource Poisoning)** : `CREATE /sites/invalid..id!` ou `zoneId` de 200 caractères.
11. **Création orpheline** : `CREATE /sites/inexistant/zones/z1` lorsque `/sites/inexistant` n'existe pas.
12. **Écriture par un spectateur (`viewer`)** : `UPDATE /sites/s1/people/p1` par un utilisateur membre ayant `role == "viewer"`.
