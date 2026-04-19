# Aggregate Features API

This synchronous endpoint aggregates low-level features from multiple categories into a single, high-level MECE set of features centered around a specific cluster.

## Cloud API (Netlify Function)

The endpoint takes multiple `categoryIds`, queries their features from MongoDB, extracts the name and description of a `clusterId` from MongoDB, and uses Gemini to generate a synthesized, high-level set of features for that cluster.

`POST {{DOMAIN}}/.netlify/functions/aggregate-features`

### Payload structure

```json
{
  "categoryIds": ["category-1", "category-2"],
  "clusterId": "649c25f4b4b2c12a74",
  "mongoDb": "{{MONGO_DB}}",
  "mongoCollection": "{{MONGO_COLLECTION}}"
}
```

- **categoryIds**: Array of strings representing category identifiers.
- **clusterId**: The ObjectId (as string) of the target cluster.
- **mongoDb**: The name of your MongoDB database (will be converted to lowercase).
- **mongoCollection**: The prefix for your MongoDB collections.

### Environment Setup

The function depends on the `GEMINI_API_KEY` for feature generation, and `MONGO_URI` to access the database.

### Response

Returns a `200 OK` status with a list of extracted, high-level features.

```json
{
  "features": [
    {
      "name": "Consolidated Theme",
      "description": "A refined, MECE description grouping the underlying ideas."
    }
  ]
}
```
