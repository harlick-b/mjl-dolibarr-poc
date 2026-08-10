# Retired MJL POC Test Scenarios

The former scenarios exercised obsolete finance, Partner-scope, role, and
persistent fixture behavior. They are retired and must not be run as target
acceptance tests.

Phase-owned target journeys are specified in `../docs/mjl-acceptance-tests.md`
and must create their own minimal records inside isolated disposable tenants.
No record or generated file may survive tenant teardown. Persistent sample data
remains prohibited until every implementation phase and the later dataset
specification are complete.
