# Prisma migrations

Create migrations from the production API package with:

```bash
npx prisma migrate dev --name init
npx prisma migrate deploy
```

Never edit an already-applied production migration. Commit generated migration folders to Git. Run `prisma migrate deploy` as the release step before the new API image receives traffic, and keep a tested `prisma db seed` script for a new tenant/campus install.
