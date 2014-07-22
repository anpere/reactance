/** @jsx React.DOM */

var PlayerList = require('./player-list.jsx')
var Settings = require('./settings.jsx')
var PT = React.PropTypes

var SetupPage = React.createClass({
    propTypes: {
        playerNames: PT.array.isRequired,
        // Mapping of settings to their values.
        settings: PT.object.isRequired,
        onAddName: PT.func.isRequired,
        onDeleteName: PT.func.isRequired,
        onChangeSettings: PT.func.isRequired,
    },

    render: function() {
        return <div>
            <PlayerList
                playerNames={this.props.playerNames}
                onDeleteName={this.props.onDeleteName} />
            <Settings
                settings={this.props.settings}
                onChangeSettings={this.props.onChangeSettings} />
        </div>
    },

    onChangeMerlin: function() {
        this.props.onChangeSettings({
            merlin: !this.props.settings.merlin
        })
    },
});

module.exports = SetupPage