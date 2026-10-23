# Be Strong online zetten — stappenplan

Je hoeft niets te programmeren. Volg de stappen in volgorde. Reken op ongeveer 15 minuten.

**Belangrijk:** de *secret key* en het *databasewachtwoord* van Supabase deel je met niemand, ook niet met Claude.

---

## Deel A — Supabase klaarzetten (jij, ±10 minuten)

### Stap 1: De database installeren

1. Ga naar **supabase.com** en log in.
2. Klik op je project **Be Strong**.
3. Klik in de linkerbalk op **SQL Editor**. Het icoon lijkt op een terminal: `>_`.
4. Klik op **+ New query**. Je krijgt een leeg tekstvak.
5. Open op je laptop de map **Documenten › Be strong › supabase**.
6. Klik met de rechtermuisknop op **setup-productie.sql** › **Openen met** › **Kladblok**.
7. Druk in Kladblok op **Ctrl + A** (alles selecteren) en daarna op **Ctrl + C** (kopiëren).
8. Ga terug naar Supabase, klik in het lege tekstvak en druk op **Ctrl + V** (plakken).
9. Klik rechtsonder op **Run** (of druk op Ctrl + Enter).
10. Onderaan moet **Success. No rows returned** verschijnen.

Je doet dit maar één keer. Krijg je een rode foutmelding? Maak dan een screenshot en stuur die naar Claude.

**Controle:** klik links op **Table Editor**. Je ziet nu onder andere `exercises`, `workouts` en `templates`.

### Stap 2: Registraties van vreemden uitzetten

1. Klik links op **Authentication**.
2. Klik op **Sign In / Providers**. In sommige versies heet dit **Providers** of zit het onder **Settings**.
3. Zet **Allow new users to sign up** op **UIT**.
4. Zet **Confirm email** ook op **UIT**.
5. Klik op **Save**.

### Stap 3: Je eigen account aanmaken

1. Klik in **Authentication** op **Users**.
2. Klik op **Add user** › **Create new user**.
3. Vul je e-mailadres in, en een **nieuw, sterk** wachtwoord. Gebruik niet het wachtwoord van Finance.
4. Vink **Auto Confirm User** aan.
5. Klik op **Create user**.

Dit is het account waarmee je straks in Be Strong inlogt.

### Stap 4: Twee adressen kopiëren voor Claude

1. Klik linksonder op het tandwiel **Project Settings**.
2. Klik op **Data API** of **API**. In sommige versies heet het **API Keys**.
3. Kopieer deze twee gegevens en stuur ze naar Claude in de chat:
   - **Project URL**: ziet eruit als `https://abcdefgh.supabase.co`;
   - **Publishable key**: begint met `sb_publishable_…`. Zie je die niet, neem dan de key met de naam **anon** / **public**.

Deze twee zijn veilig om te delen, want ze zitten later ook gewoon in de app. Stuur **niet** de key met de naam *secret* of *service_role*.

---

## Deel B — Wat Claude daarna doet

- Claude zet de twee gegevens in de app en start ze op je laptop.
- Jij logt in met het account uit stap 3. Claude typt je wachtwoord niet in.
- Samen testen jullie of alles synchroniseert.
- Daarna importeer je in de app je templates en je Strong-geschiedenis, via **Instellingen**.

---

## Deel C — Later: op je iPhone zetten

Dit volgt pas als deel A en B werken. Claude helpt je dan om:

1. een GitHub-repository aan te maken (net zoals bij Finance) en de app online te zetten;
2. op je iPhone de app-link te openen › **Deel** › **Zet op beginscherm**.
