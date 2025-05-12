Feature: Inital Loading
  In order to use viewer-swisgeol.ch,
  I want load the web application with its initial settings
  So that I can start to use it without any presets

  Background:
    Given the viewer is fully loaded
    And the user has internet accessible
    And the user is loading https://viewer.swissgeol.ch in a web-browser

  Scenario: Initial Loading
    When the user loading https://viewer.swissgeol.ch in a web-browser
    Then the web application opens
    * the data displayed panel shows only the grey topgraphic background map
    * no other layers are displayed
    * the entire background layer is visible



