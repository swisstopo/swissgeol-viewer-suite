Feature: Handle user session
  As a user
  I want to be able to sign in and sign out with my account.

  Background:
    Given the viewer is fully loaded

  Scenario: Initiate sign in
    Given that no user is signed in
    When the user clicks on the session button
    Then the user is redirected to the external eIAM login page

  Scenario: Finalize sign in
    Given that no user is signed in
    When the page is accessed with eIAM response query parameters
    Then signed in user's profile is loaded

  Scenario: Display session information
    Given that a user is signed in
    When the user clicks on the session button
    Then the session dropdown opens
    And the user's name is shown in the session dropdown

  Scenario: Sign out
    Given that a user is signed in
    When the user clicks on the session button
    And the user clicks the sign out button
    Then the user is signed out

  Scenario: Load cached session
    Given that a user is signed in
    When the page is reloaded
    Then signed in user's profile is loaded
#
  Scenario: Session expiry
    Given that a user is signed in
    When the user's session expires
    Then the user is signed out
