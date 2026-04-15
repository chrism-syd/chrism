# Schema Diagram — Apr 14

## Legend
- [FUTURE] = future truth / target architecture
- [TRANSITIONAL] = still in use, but not conceptual north star
- [LEGACY] = compatibility residue

```text
                           +------------------+
                           |      users       |
                           |------------------|
                           | id               |
                           | person_id        |  [TRANSITIONAL weak anchor]
                           | council_id       |  [LEGACY residue]
                           +---------+--------+
                                     |
                                     | primary_user_id
                                     v
                    +----------------------------------+
                    |        person_identities         |  [FUTURE]
                    |----------------------------------|
                    | id                               |
                    | primary_user_id                  |
                    | display_name                     |
                    | normalized_email_hash            |
                    | normalized_phone_hash            |
                    +----------------+-----------------+
                                     |
                                     | person_identity_id
                                     v
                    +----------------------------------+
                    |      person_identity_links       |  [FUTURE]
                    |----------------------------------|
                    | person_identity_id               |
                    | person_id                        |
                    | link_source                      |
                    | confidence_code                  |
                    | ended_at                         |
                    +----------------+-----------------+
                                     |
                                     | person_id
                                     v
                           +------------------+
                           |      people      |  [FUTURE product noun,
                           |------------------|   legacy physical table]
                           | id               |
                           | council_id       |  [LEGACY residue]
                           | archived_at      |
                           | merged_into...   |
                           +--------+---------+
                                    |
                +-------------------+-------------------+
                |                                       |
                | person_id                             | legacy_people_id
                v                                       v
     +--------------------------+          +--------------------------+
     |    local_unit_people     |          |      member_records      |
     |--------------------------|          |--------------------------|
     | local_unit_id            |          | local_unit_id            |
     | person_id                |          | legacy_people_id         |
     | ended_at                 |          | legacy_council_id        |
     +-------------+------------+          | lifecycle_state          |
                   |                       +-------------+------------+
                   | local_unit_id                       |
                   v                                     |
             +------------------+                       |
             |   local_units    |  [FUTURE scope]      |
             |------------------|                       |
             | id               |                       |
             | legacy_council_id|  [LEGACY bridge]     |
             +--------+---------+                       |
                      |                                 |
                      v                                 v
                +-----------+                 +------------------------+
                | councils  |  [LEGACY/public]| user_unit_relationships|
                +-----------+                 |------------------------|
                                              | user_id                |
                                              | local_unit_id          |
                                              | member_record_id       |
                                              | status                 |
                                              +-----------+------------+
                                                          |
                                                          v
                                         +-------------------------------+
                                         |      area_access_grants       |
                                         |      resource_access_grants   |
                                         |-------------------------------|
                                         | member_record_id              |
                                         | local_unit_id                 |
                                         +-------------------------------+

Custom lists
------------

+------------------+        +----------------------+
|   custom_lists   |        |  custom_list_access  |
|------------------|        |----------------------|
| id               |<------>| custom_list_id       |
| local_unit_id    |        | person_id            |
| council_id       | [bridge| user_id              |
+--------+---------+        +----------------------+
         |
         v
+----------------------+
| custom_list_members  |
|----------------------|
| custom_list_id       |
| person_id            |
| claimed_by_person_id |
+----------------------+

Events
------

+------------------+
|      events      |
|------------------|
| id               |
| local_unit_id    |  [FUTURE operational scope]
| council_id       |  [public/compat bridge]
+------------------+