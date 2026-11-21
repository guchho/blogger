# Error codes

Errors use a stable machine-readable `code` and a human-readable `message`.
Route responses use the property `error`; programmatic `ContentError` instances
use `code`.

```json
{
  "error": "BLOGGER_CONTENT_NOT_FOUND",
  "message": "post not found"
}
```

Additional fields may be included as details. For example, stale writes include
the current `hash`.

## HTTP status mapping

| Status | Typical causes |
| --- | --- |
| `400` | Invalid input, schema errors, malformed JSON, invalid IDs, unknown fields. |
| `403` | Content path outside the project or non-localhost origin for the save service. |
| `404` | Unknown route/action or missing item. |
| `409` | Stale write, duplicate ID, slug conflict, route conflict or reserved route. |
| `413` | Content body exceeds 4 MB. |
| `500` | Unexpected internal failure. |

## Content errors

| Code | Meaning |
| --- | --- |
| `BLOGGER_CONTENT_INVALID` | Input is not a valid object or required data is missing. |
| `BLOGGER_CONTENT_INVALID_FIELD` | A field has the wrong type or an empty required string. |
| `BLOGGER_CONTENT_INVALID_JSON` | A JSON file or request body cannot be parsed. |
| `BLOGGER_CONTENT_UNKNOWN_FIELD` | A content object contains an unsupported field. |
| `BLOGGER_CONTENT_INVALID_ID` | ID contains unsupported characters. |
| `BLOGGER_CONTENT_INVALID_SLUG` | Slug is not lowercase alphanumeric with single hyphens. |
| `BLOGGER_CONTENT_INVALID_STATUS` | Status is not `draft`, `published` or `scheduled`. |
| `BLOGGER_CONTENT_INVALID_DATE` | Timestamp is not an ISO 8601 UTC value. |
| `BLOGGER_CONTENT_MISSING_PUBLISH_DATE` | Scheduled content has no `publishAt`. |
| `BLOGGER_CONTENT_WRONG_TYPE` | Post and page schemas were mixed. |
| `BLOGGER_CONTENT_NOT_FOUND` | Content file does not exist. |
| `BLOGGER_CONTENT_ALREADY_EXISTS` | A file with the ID already exists. |
| `BLOGGER_CONTENT_SLUG_CONFLICT` | Another item uses the slug; details include `suggested`. |
| `BLOGGER_CONTENT_STALE` | File changed since it was read; details include current `hash`. |
| `BLOGGER_CONTENT_TOO_LARGE` | Request body exceeds 4 MB. |
| `BLOGGER_CONTENT_INVALID_ACTION` | Unknown bulk action. |
| `BLOGGER_CONTENT_ROUTE_MISSING` | Unknown content action or route. |
| `BLOGGER_CONTENT_PATH_FORBIDDEN` | Configured path or resolved file escapes the project root. |
| `BLOGGER_CONTENT_ROUTE_RESERVED` | Generated route is reserved by the preview system. |
| `BLOGGER_CONTENT_ROUTE_CONFLICT` | Two published items would use the same route. |
| `BLOGGER_CONTENT_INTERNAL` | Unexpected content API failure. |

## Layout save service errors

| Code | Meaning |
| --- | --- |
| `BLOGGER_LAYOUT_ORIGIN_FORBIDDEN` | Save request came from a non-localhost origin. |
| `BLOGGER_LAYOUT_ROUTE_MISSING` | Unknown save-service route. |
| `BLOGGER_LAYOUT_SAVE_INVALID` | Required save fields are missing or malformed. |
| `BLOGGER_LAYOUT_SAVE_FORBIDDEN` | Save targets a path outside the configured entry. |
| `BLOGGER_LAYOUT_STALE` | Template changed since the editor loaded it. |
| `BLOGGER_LAYOUT_SAVE_TOO_LARGE` | Save payload exceeds 1 MB. |
| `BLOGGER_LAYOUT_INTERNAL` | Unexpected save-service failure. |
| `BLOGGER_LAYOUT_SAVE_UNAVAILABLE` | Port could not be bound or reused by a matching service. |
| `BLOGGER_LAYOUT_SAVE_STOP_FAILED` | Save service could not be closed cleanly. |

## Build and preview diagnostics

These codes appear as plugin warnings rather than HTTP errors.

| Code | Meaning |
| --- | --- |
| `BLOGGER_CONTENT_PATH_FORBIDDEN` | Content directories could not be resolved inside the project. |
| `BLOGGER_CONTENT_SEED_FAILED` | The default post could not be created; existing content is still loaded. |
| `BLOGGER_CONTENT_LOAD_FAILED` | Content files could not be loaded. |
| `BLOGGER_CONTENT_RENDER_FAILED` | Static content pages could not be rendered. |
| `BLOGGER_CONTENT_ROUTE_INVALID` | A content route could not be mapped to a safe file. |
| `BLOGGER_PREVIEW_FAILED` | A preview page could not be rendered. |
| `BLOGGER_PREVIEW_ROUTE_INVALID` | A preview route could not be mapped safely. |
| `BLOGGER_PREVIEW_ROUTE_CONFLICT` | A preview route collided with another output file. |

See [Blogger compatibility](../blogger-compatibility.md) for expression and
widget diagnostic codes, and [Troubleshooting](../troubleshooting.md) for
recovery steps.
