@skip

Feature: Select data from data catalog
  In order to display layer in viewer.swissgeol.ch
  As a user I need to select and activate the respective layers in the data catalog
  So that I can use them

  Background:
    Given the viewer is fully loaded

  Scenario: Select data from data catalog
    When the user is hovering in the side bar on the upper most icon
    Then a tooltip appears showing the name of the icon

    When the user clicks on the icon
    Then the data displayed panel appears to the right of the sidebar
    And the data catalog is selected in the bottom part of the panel and shows the names of the top categories

    When the user clicks on a category name
    Then the content, i.e. the sub-catagores or layers are displayed

    When the user clicks on a layer
    Then the checkbox is checked
    And the layer is added one time at the top of the data dislayed section
