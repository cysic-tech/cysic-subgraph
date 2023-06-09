/* eslint-disable prefer-const */
import { Address, BigDecimal } from "@graphprotocol/graph-ts/index";
import { Bundle, Pair, Token } from "../generated/schema";
import { ADDRESS_ZERO, factoryContract, ONE_BD, ZERO_BD } from "./utils";

// prettier-ignore
let WETH_ADDRESS = "0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9";
// prettier-ignore
let WETH_USDT_PAIR = "0xcd9ea826c0090a8f7f36989171332bb007d3bd70";
// prettier-ignore
let WETH_USDC_PAIR = "0x87414519f4121352657d755fc6ccce8e0b45596b";

export function getETHPriceInUSD(): BigDecimal {
  // fetch eth prices for each stablecoin
  let usdcPair = Pair.load(WETH_USDC_PAIR); // usdc is token0
  let usdtPair = Pair.load(WETH_USDT_PAIR); // usdt is token1

  if (usdcPair !== null && usdtPair !== null) {
    let totalLiquidityBNB = usdtPair.reserve0.plus(usdcPair.reserve1);
    if (totalLiquidityBNB.notEqual(ZERO_BD)) {
      let usdtWeight = usdtPair.reserve0.div(totalLiquidityBNB);
      let usdcWeight = usdcPair.reserve1.div(totalLiquidityBNB);
      return usdtPair.token1Price.times(usdtWeight).plus(usdcPair.token0Price.times(usdcWeight));
    } else {
      return ZERO_BD;
    }
  } else if (usdtPair !== null) {
    return usdtPair.token1Price;
  } else if (usdcPair !== null) {
    return usdcPair.token0Price;
  } else {
    return ZERO_BD;
  }
}

// token where amounts should contribute to tracked volume and liquidity
// prettier-ignore
let WHITELIST: string[] = "0x4f9a0e7fd2bf6067db6994cf12e4495df938e6e9,0x1e4a5963abfd975d8c9021ce480b42188849d41d,0xa8ce8aee21bc2a48a5ef670afcc9274c7bbbc035,0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270".split(",");

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_ETH = BigDecimal.fromString("5");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findEthPerToken(token: Token): BigDecimal {
  if (token.id == WETH_ADDRESS) {
    return ONE_BD;
  }
  // loop through whitelist and check if paired with any
  for (let i = 0; i < WHITELIST.length; ++i) {
    let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
    if (pairAddress.toHex() != ADDRESS_ZERO) {
      let pair = Pair.load(pairAddress.toHex());
      if (pair.token0 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token1 = Token.load(pair.token1);
        return pair.token1Price.times(token1.derivedETH as BigDecimal); // return token1 per our token * BNB per token 1
      }
      if (pair.token1 == token.id && pair.reserveETH.gt(MINIMUM_LIQUIDITY_THRESHOLD_ETH)) {
        let token0 = Token.load(pair.token0);
        return pair.token0Price.times(token0.derivedETH as BigDecimal); // return token0 per our token * BNB per token 0
      }
    }
  }
  return ZERO_BD; // nothing was found return 0
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD.
 * If both are, return average of two amounts
 * If neither is, return 0
 */
export function getTrackedVolumeUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1)).div(BigDecimal.fromString("2"));
  }

  // take full value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0);
  }

  // take full value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1);
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedLiquidityUSD(
  bundle: Bundle,
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token
): BigDecimal {
  let price0 = token0.derivedETH.times(bundle.ethPrice);
  let price1 = token1.derivedETH.times(bundle.ethPrice);

  // both are whitelist tokens, take average of both amounts
  if (WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).plus(tokenAmount1.times(price1));
  }

  // take double value of the whitelisted token amount
  if (WHITELIST.includes(token0.id) && !WHITELIST.includes(token1.id)) {
    return tokenAmount0.times(price0).times(BigDecimal.fromString("2"));
  }

  // take double value of the whitelisted token amount
  if (!WHITELIST.includes(token0.id) && WHITELIST.includes(token1.id)) {
    return tokenAmount1.times(price1).times(BigDecimal.fromString("2"));
  }

  // neither token is on white list, tracked volume is 0
  return ZERO_BD;
}
