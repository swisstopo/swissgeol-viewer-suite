Feature: Inital Loading
  In order to use viewer-swissgeol.ch,
  I want load the web application with its initial settings
  So that I can start to use it without any presets

  Background:
    Given the viewer is fully loaded

  Scenario: Initial Loading
    When the data panel is open
    Then the data displayed panel shows the grey topographic background map
    Then no other layers are displayed
    Then the entire background layer is visible



