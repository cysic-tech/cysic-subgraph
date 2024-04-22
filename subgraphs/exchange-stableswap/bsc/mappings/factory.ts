/* eslint-disable prefer-const */
import { DataSourceContext, log } from "@graphprotocol/graph-ts";
import { BIG_DECIMAL_ZERO, BIG_INT_ONE, BIG_INT_ZERO, ADDRESS_ZERO } from "./utils";
import { getOrCreateFactory, getOrCreateToken } from "./utils/data";
import { NewStableSwapPair } from "../generated/StableSwapFactory/StableSwapFactory";
import { ERC20, StableSwapPair, StableSwapNG } from "../generated/templates";
import { Pair } from "../generated/schema";
import { AbstractStableSwap } from "../generated/StableSwapFactory/AbstractStableSwap";

export function handlePairCreated(event: NewStableSwapPair): void {
  log.info("handlePairCreated. address: {}", [event.address.toHex()]);
  let pair = Pair.load(event.params.swapContract.toHex());
  let factory = getOrCreateFactory(event.address.toHex());
  if (pair === null) {
    let token0 = getOrCreateToken(event.params.tokenA);
    let token1 = getOrCreateToken(event.params.tokenB);

    pair = new Pair(event.params.swapContract.toHex());

    if (event.params.tokenC.toHex() != ADDRESS_ZERO) {
      let token2 = getOrCreateToken(event.params.tokenC);
      pair.token2 = token2.id;
      pair.token2Price = BIG_DECIMAL_ZERO;
      pair.reserve2 = BIG_DECIMAL_ZERO;
    }
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.name = token0.symbol.concat("-").concat(token1.symbol);

    pair.token0Price = BIG_DECIMAL_ZERO;
    pair.token1Price = BIG_DECIMAL_ZERO;
    pair.volumeToken0 = BIG_DECIMAL_ZERO;
    pair.volumeToken1 = BIG_DECIMAL_ZERO;
    pair.volumeUSD = BIG_DECIMAL_ZERO;
    pair.volumeOutUSD = BIG_DECIMAL_ZERO;
    pair.totalTransactions = BIG_INT_ZERO;
    pair.reserve0 = BIG_DECIMAL_ZERO;
    pair.reserve1 = BIG_DECIMAL_ZERO;
    pair.trackedReserveBNB = BIG_DECIMAL_ZERO;
    pair.reserveBNB = BIG_DECIMAL_ZERO;
    pair.reserveUSD = BIG_DECIMAL_ZERO;
    pair.untrackedVolumeUSD = BIG_DECIMAL_ZERO;
    pair.totalSupply = BIG_DECIMAL_ZERO;

    pair.virtualPrice = BIG_DECIMAL_ZERO;
    pair.block = event.block.number;
    pair.timestamp = event.block.timestamp;
    pair.factory = factory.id;

    pair.save();
  }

  factory.pairs = factory.pairs.concat([pair.id]);
  factory.totalPairs = factory.totalPairs.plus(BIG_INT_ONE);
  factory.save();

  let ssToken = AbstractStableSwap.bind(event.params.swapContract).token();
  let isNGPool = ssToken.equals(event.params.swapContract);
  if (isNGPool) {
    StableSwapNG.create(event.params.swapContract);
  } else {
    StableSwapPair.create(event.params.swapContract);
  }

  let context = new DataSourceContext();
  context.setString("pairAddress", event.params.swapContract.toHex());
  ERC20.createWithContext(ssToken, context);
}
