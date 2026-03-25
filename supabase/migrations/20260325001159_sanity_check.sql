alter table "public"."person_officer_terms" drop constraint "person_officer_terms_check";

alter table "public"."person_officer_terms" add constraint "person_officer_terms_check" CHECK (((service_end_year IS NULL) OR (((service_end_year >= 1900) AND (service_end_year <= 2100)) AND (service_end_year >= service_start_year)))) not valid;

alter table "public"."person_officer_terms" validate constraint "person_officer_terms_check";


