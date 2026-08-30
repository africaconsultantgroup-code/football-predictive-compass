create table public.public_predictions (
  public_prediction_id text primary key,
  league text not null,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  predicted_winner text not null,
  predicted_home_score smallint not null,
  predicted_away_score smallint not null,
  home_win_percentage numeric(5, 2) not null,
  draw_percentage numeric(5, 2) not null,
  away_win_percentage numeric(5, 2) not null,
  confidence_percentage numeric(5, 2) not null,
  customer_summary text not null,
  customer_key_factors jsonb not null default '[]'::jsonb,
  publication_status text not null,
  source_updated_at timestamptz not null,
  publication_version integer not null,
  published_at timestamptz not null,
  settlement_status text,
  actual_home_score smallint,
  actual_away_score smallint,
  result_outcome text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint public_predictions_public_prediction_id_not_blank
    check (length(btrim(public_prediction_id)) > 0),
  constraint public_predictions_league_not_blank
    check (length(btrim(league)) > 0),
  constraint public_predictions_home_team_not_blank
    check (length(btrim(home_team)) > 0),
  constraint public_predictions_away_team_not_blank
    check (length(btrim(away_team)) > 0),
  constraint public_predictions_distinct_teams
    check (lower(btrim(home_team)) <> lower(btrim(away_team))),
  constraint public_predictions_predicted_winner_valid
    check (predicted_winner in ('home', 'draw', 'away')),
  constraint public_predictions_predicted_home_score_nonnegative
    check (predicted_home_score >= 0),
  constraint public_predictions_predicted_away_score_nonnegative
    check (predicted_away_score >= 0),
  constraint public_predictions_home_win_percentage_valid
    check (home_win_percentage between 0 and 100),
  constraint public_predictions_draw_percentage_valid
    check (draw_percentage between 0 and 100),
  constraint public_predictions_away_win_percentage_valid
    check (away_win_percentage between 0 and 100),
  constraint public_predictions_confidence_percentage_valid
    check (confidence_percentage between 0 and 100),
  constraint public_predictions_outcome_percentages_total
    check (
      home_win_percentage + draw_percentage + away_win_percentage = 100
    ),
  constraint public_predictions_customer_summary_not_blank
    check (length(btrim(customer_summary)) > 0),
  constraint public_predictions_customer_key_factors_string_array
    check (
      jsonb_typeof(customer_key_factors) = 'array'
      and not jsonb_path_exists(
        customer_key_factors,
        '$[*] ? (@.type() != "string")'
      )
    ),
  constraint public_predictions_publication_status_valid
    check (
      publication_status in ('published', 'updated', 'withdrawn', 'settled')
    ),
  constraint public_predictions_publication_version_positive
    check (publication_version > 0),
  constraint public_predictions_actual_home_score_nonnegative
    check (actual_home_score is null or actual_home_score >= 0),
  constraint public_predictions_actual_away_score_nonnegative
    check (actual_away_score is null or actual_away_score >= 0),
  constraint public_predictions_result_outcome_valid
    check (result_outcome is null or result_outcome in ('home', 'draw', 'away'))
);

alter table public.public_predictions enable row level security;

revoke all on table public.public_predictions from public;
revoke all on table public.public_predictions from anon;
revoke all on table public.public_predictions from authenticated;
