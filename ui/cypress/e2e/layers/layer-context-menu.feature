@skip

Feature: Use context menu in Layers
In order to get meta information o a layer and to get access to specific tools
As a user I need to use the context menu of an individual layer

Background:
  Given the viewer is fully loaded
  And a least one layer is in the data displayed section of the data panel and it is visible in the 3D scene
  And the drop down menu is open

  Scenario: Use context menu
    When the user clicks on the zoom-to option
    Then the camera zooms the extent of the entire layer

    When the user clicks on the geocat option
    Then the meta date page of the respective layer of https://www.geocat.ch opens in a separate browser tab

    When the user clicks on the legend option (if it exists)
    Then the legend panel opend and shows the legend

    When the user clicks on the delete option
    Then the respective layer will be removed from the data displayed section

    When the user clicks on the download/legend option (if it exists)
    Then the data and legend will be downloaded

    When the user clicks on the Zeitreise option (if it exists)
    Then the Zeitreise panel opens

    When the user clicks on the filter option (if exists)
    Then the filter panel opens




