import { getTheme, ITextField, KeyCodes, Label, TextField } from 'office-ui-fabric-react';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';

import { IAutoCompleteProps, IAutoCompleteState } from '../../../../types/auto-complete';
import * as autoCompleteActionCreators from '../../../services/actions/autocomplete-action-creators';
import { parseSampleUrl } from '../../../utils/sample-url-generation';
import { queryInputStyles } from './QueryInput.styles';
import { cleanUpSelectedSuggestion, getLastCharacterOf, getParametersWithVerb } from './util';

class AutoComplete extends Component<IAutoCompleteProps, IAutoCompleteState> {
  private autoCompleteRef: React.RefObject<ITextField>;

  constructor(props: IAutoCompleteProps) {
    super(props);

    this.autoCompleteRef = React.createRef();

    this.state = {
      activeSuggestion: 0,
      filteredSuggestions: [],
      suggestions: [],
      showSuggestions: false,
      userInput: this.props.sampleQuery.sampleUrl,
      compare: ''
    };
  }

  public setFocus() {
    if (this.autoCompleteRef && this.autoCompleteRef.current) {
      this.autoCompleteRef.current.focus();
    }
  }

  public onChange = (e: any) => {
    const { suggestions, showSuggestions, userInput: previousUserInput, compare } = this.state;
    const userInput = e.target.value;

    this.props.contentChanged(userInput);

    this.setState({
      userInput
    });

    if (showSuggestions && suggestions.length) {
      this.filterSuggestions(userInput, previousUserInput, compare, suggestions);
    }
    this.initialiseAutoComplete(userInput);
  };

  public onClick = (e: any) => {
    const selected = e.currentTarget.innerText;
    this.appendSuggestionToUrl(selected);
  };

  private initialiseAutoComplete = (url: string) => {
    switch (getLastCharacterOf(url)) {
      case '/':
        this.requestForAutocompleteOptions(url);
        break;

      case '?':
        this.requestForAutocompleteOptions(url);
        break;

      case '=':

        if (url.includes('?$')) {
          this.getParameterEnums(url);
        }

        break;

      case ',':
        this.getParameterEnums(url);
        break;

      case '&':
        this.getQueryParameters();
        break;

      default:
        break;
    }
  }

  public onKeyDown = (e: any) => {
    const { activeSuggestion, filteredSuggestions, showSuggestions } = this.state;

    switch (e.keyCode) {
      case KeyCodes.enter:
        if (showSuggestions) {
          const selected = filteredSuggestions[activeSuggestion];
          this.appendSuggestionToUrl(selected);
        } else {
          this.props.runQuery();
        }
        break;

      case KeyCodes.up:
        if (activeSuggestion === 0) {
          return;
        }
        this.setState({ activeSuggestion: activeSuggestion - 1 });
        break;

      case KeyCodes.down:
        if (activeSuggestion === filteredSuggestions.length - 1) {
          return;
        }
        this.setState({ activeSuggestion: activeSuggestion + 1 });
        break;

      default:
        break;
    }

  };

  public displayLinkOptions = () => {
    const parametersWithVerb = getParametersWithVerb(this.props);
    if (!parametersWithVerb) {
      return;
    }
    this.setSuggestions(parametersWithVerb.links);
  }

  public getQueryParameters = () => {
    const parametersWithVerb = getParametersWithVerb(this.props);
    if (!parametersWithVerb) {
      return;
    }
    this.setSuggestions(parametersWithVerb.values.map((value: { name: any; }) => value.name));
  }

  private getParameterEnums = (url: string) => {
    const parametersWithVerb = getParametersWithVerb(this.props);
    if (!parametersWithVerb) {
      return;
    }
    const param = url.split('$').pop()!.split('=')[0];
    const section = parametersWithVerb.values.find((k: { name: string; }) => {
      return k.name === `$${param}`;
    });

    if (section && section.items && section.items.length > 0) {
      this.setSuggestions(section.items);
    }
  }

  private setSuggestions(suggestions: string[]) {
    this.setState({
      filteredSuggestions: suggestions,
      suggestions,
      showSuggestions: true,
      compare: ''
    });
  }

  public componentDidUpdate = (prevProps: IAutoCompleteProps) => {
    if (prevProps.autoCompleteOptions !== this.props.autoCompleteOptions) {
      if (this.props.autoCompleteOptions) {
        this.performLocalSearch(this.props.sampleQuery.sampleUrl);
      }
    }
  }

  private filterSuggestions(userInput: string, previousUserInput: string, compare: string, suggestions: string[]) {
    let compareString = userInput.replace(previousUserInput, '');
    if (compare) {
      compareString = compare + compareString;
    }
    // Filter our suggestions that don't contain the user's input
    const filteredSuggestions = suggestions.filter((suggestion: string) => {
      return suggestion.toLowerCase().indexOf(compareString.toLowerCase()) > -1;
    });
    this.setState({
      filteredSuggestions,
      compare: compareString
    });
  }

  private requestForAutocompleteOptions(url: string) {
    const { requestUrl, queryVersion } = parseSampleUrl(url);
    if (requestUrl || queryVersion) {
      if (!this.props.autoCompleteOptions || `${requestUrl}` !== this.props.autoCompleteOptions.url) {
        this.props.actions!.fetchAutoCompleteOptions(requestUrl);
      }
      else {
        this.performLocalSearch(url);
      }
    }
  }

  private performLocalSearch(url: string) {
    switch (getLastCharacterOf(url)) {
      case '/':
        this.displayLinkOptions();
        break;

      case '?':
        this.getQueryParameters();
        break;

      default:
        break;
    }
  }

  private appendSuggestionToUrl(selected: string) {
    const { userInput, compare } = this.state;
    const selectedSuggestion = cleanUpSelectedSuggestion(compare, userInput, selected);
    this.setState({
      activeSuggestion: 0,
      filteredSuggestions: [],
      showSuggestions: false,
      userInput: selectedSuggestion,
      compare: ''
    });
    this.props.contentChanged(selectedSuggestion);
    this.setFocus();
  }

  public render() {
    const {
      activeSuggestion,
      filteredSuggestions,
      showSuggestions,
      userInput
    } = this.state;

    const { fetchingSuggestions, sampleQuery } = this.props;

    const currentTheme = getTheme();
    const { suggestions: suggestionClass,
      suggestionOption,
      suggestionActive: activeSuggestionClass,
      input: autoInput,
      suggestionTitle }: any = queryInputStyles(currentTheme).autoComplete;

    let suggestionsListComponent;

    if (showSuggestions && userInput) {
      if (filteredSuggestions.length) {
        suggestionsListComponent = (
          <ul style={suggestionClass} aria-haspopup='true'>
            {filteredSuggestions.map((suggestion: {} | null | undefined, index: number) => {
              return (
                <li
                  style={(index === activeSuggestion) ? activeSuggestionClass : suggestionOption}
                  key={index}
                  onClick={this.onClick}
                >
                  <Label style={suggestionTitle}>
                    {suggestion}
                  </Label>
                </li>
              );
            })}
          </ul>
        );
      }
    }

    return (
      <>
        <TextField
          className={autoInput}
          type='text'
          autoComplete='off'
          onChange={this.onChange}
          onKeyDown={this.onKeyDown}
          defaultValue={userInput}
          value={sampleQuery.sampleUrl}
          suffix={(fetchingSuggestions) ? '...' : undefined}
          componentRef={this.autoCompleteRef}
        />
        {suggestionsListComponent}
      </>
    );
  }
}

function mapStateToProps(state: any) {
  return {
    sampleQuery: state.sampleQuery,
    appTheme: state.theme,
    autoCompleteOptions: state.autoComplete.data,
    fetchingSuggestions: state.autoComplete.pending
  };
}

function mapDispatchToProps(dispatch: Dispatch): object {
  return {
    actions: bindActionCreators(
      {
        ...autoCompleteActionCreators,
      },
      dispatch
    )
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(AutoComplete);
