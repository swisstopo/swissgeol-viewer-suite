Feature: Shorten long layernames
    In order to show layernames on one single line
    Layer names longer than 29 characters shall be shortened
    So that the rest of the name is represented by three dots and the layername fits to one line

    Background: Layers with long names are selected from swissgeol-layertree, search box, cesium-ion upload or kml-upload

    Scenario: Long layer names
        When a layer name from the layertree exceeds 25 characters
        Then the layer name form the 1st to the 25th characters is displayed
        And the rest of the layer name is not shown but represented by three dots
    