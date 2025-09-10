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