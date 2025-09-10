Feature: Search
  As a user,
  I want to be able to search layers and locations via text.

  Background:
    Given the viewer is fully loaded
    And the search input is focused

  Scenario: Search by full name
    When the query "Top Muschelkalk" is entered
    Then the results contain the "top_muschelkalk" layer

  Scenario: Search by partial name
    When the query "Molasse" is entered
    Then the results contain the "top_omm" layer
    Then the results contain the "top_usm" layer
    Then the results contain the "top_umm" layer

  Scenario: Match by label
    When the query "Zug" is entered
    Then all search results contain the string "Zug"

  Scenario: Prefer catalog over WMTS
    When the query "lithology 500" is entered
    Then there is 1 search result
    And the results contain the "ch.swisstopo.geologie-geotechnik-gk500-lithologie_hauptgruppen" layer

  Scenario: Order of results
    When the query "swiss" is entered
    Then the results contain all three item types in the correct order
