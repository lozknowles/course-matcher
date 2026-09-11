# Skills England career data refresh

This bounded refresh produces the Student Hub career reference snapshot. It maps occupational routes, standards, progression relationships, SOC 2020 data, job titles, products, statuses and versions from the Skills England Occupational Maps API. It does not map salary data, local labour-market information, or reviewed course recommendations.

## Credential-free normalization

Normalize a previously obtained raw envelope without API access:

```sh
node scripts/refresh-skills-england.mjs --input raw.json --output snapshot.json
```

The input must include schema version 1, provider `Skills England`, retrieval and source metadata, routes or occupations, licence details, and attribution. Invalid metadata or an empty occupation set are rejected; non-canonical URLs are discarded.

## Host-only live refresh

On an authorised host, keep the API key in a file outside the repository and run:

```sh
node scripts/refresh-skills-england.mjs --key-file external/path/to/key --output snapshot.json --seed OCC0015 --seed OCC0019
```

`--seed` is repeatable (maximum 32) and caches the requested progression responses. Alternatively, set `SKILLS_ENGLAND_API_KEY_FILE` to the external key-file path and omit `--key-file`. Never commit or serialize the key: snapshots contain only public data and request provenance.

The client uses the fixed HTTPS API origin `https://occupational-maps-api.skillsengland.education.gov.uk`, rejects redirects, and applies a 15-second timeout per request. Each successful endpoint is recorded with retrieval time and HTTP status. Writes use a temporary file followed by an atomic rename, so a failed fetch, validation, or write leaves the last good output intact. Route and occupation data can still advance while progression coverage remains partial and explicitly cached by seed in `progressionCoverage`.

## Provenance and interpretation

Snapshots retain their source retrieval date, per-endpoint source metadata, dataset version when supplied, occupational status/status name, version number, and status update date. Public links are accepted only from the canonical Occupational Maps host, including `mapURL`, `occupationalStandardURL`, and `occupationalProgressionURL` relationships. A native `soc.soc2020Code` value of `0` means unavailable and is normalized to `null`.

Required attribution is `© Skills England 2025`, with the canonical Skills England logo and public API source. Data is licensed under the `Open Government Licence v3.0` at exactly:

`https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/`

The bounded host proof at commit `ecb38b6` completed 17 requests and normalized 1,287 occupation records. The full 15-seed snapshot used for that demonstration came from a read-only bootstrap; this is not a claim that every seed was fetched by that CLI proof.
